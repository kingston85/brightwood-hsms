/* ==========================================================================
   Brightwood HSMS — Stripe payment backend (Firebase Cloud Functions)

   Two functions:
     - createCheckoutSession (callable): a signed-in student/parent asks for
       a Stripe-hosted Checkout page for one of THEIR OWN unpaid invoices.
       Stripe Checkout automatically offers card entry plus Google Pay/Apple
       Pay as an "express checkout" option on supporting browsers/devices —
       there's nothing extra to configure for Google Pay specifically.
     - stripeWebhook (HTTP): Stripe calls this when a checkout session
       completes. We verify Stripe's signature (so nobody can fake a
       "payment succeeded" call), then mark the invoice paid using the
       Admin SDK, which bypasses Firestore Security Rules — this is the ONE
       place in the whole app where a payment can actually be recorded
       automatically, precisely because it's verified server-side.

   This file only runs anything once you:
     1. Set your Stripe secret key + webhook signing secret as Cloud
        Functions secrets (see README.md).
     2. Deploy with `firebase deploy --only functions`.
     3. Register the deployed stripeWebhook URL in your Stripe Dashboard
        under Developers -> Webhooks, listening for checkout.session.completed.
     4. Set STRIPE_CONFIG.ENABLED = true in js/stripe-pay.js.

   Until then, the app simply doesn't show the "Pay with Card / Google Pay"
   button — everything else (Mobile Money / Bank submit-and-verify) works
   without any of this.
   ========================================================================== */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Stripe = require('stripe');

initializeApp();
const db = getFirestore();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
// The URL your app is actually served from, e.g.
// https://yourschool.github.io/brightwood-hsms — Stripe redirects the
// parent's browser back here after checkout. Easiest way to set it: create
// a file named `.env` in this `functions` folder containing one line:
//   APP_URL=https://yourschool.github.io/brightwood-hsms
// (see README.md — do not commit real secrets, but this one's just a URL).
const APP_URL = defineString('APP_URL', { default: 'http://localhost:8000' });

function stripeClient() {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2024-06-20' });
}

exports.createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to pay an invoice.');
  }
  const invoiceId = request.data && request.data.invoiceId;
  if (!invoiceId) {
    throw new HttpsError('invalid-argument', 'invoiceId is required.');
  }

  const profileSnap = await db.collection('users').doc(request.auth.uid).get();
  if (!profileSnap.exists) {
    throw new HttpsError('permission-denied', 'No account profile found.');
  }
  const profile = profileSnap.data();

  const invoiceRef = db.collection('invoices').doc(invoiceId);
  const invoiceSnap = await invoiceRef.get();
  if (!invoiceSnap.exists) {
    throw new HttpsError('not-found', 'Invoice not found.');
  }
  const invoice = invoiceSnap.data();

  const isOwner = profile.role === 'student' && profile.linkedId === invoice.studentId;
  if (!isOwner && profile.role !== 'admin') {
    throw new HttpsError('permission-denied', 'You can only pay your own invoices.');
  }

  const dueCents = Math.round((Number(invoice.amount) - Number(invoice.paidAmount || 0)) * 100);
  if (dueCents <= 0) {
    throw new HttpsError('failed-precondition', 'This invoice is already fully paid.');
  }

  const stripe = stripeClient();
  const base = APP_URL.value().replace(/\/+$/, '');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `${invoice.label} — ${invoice.term} ${invoice.year}` },
          unit_amount: dueCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId,
      studentId: invoice.studentId,
      uid: request.auth.uid,
    },
    success_url: `${base}/index.html?stripe=success`,
    cancel_url: `${base}/index.html?stripe=cancelled`,
  });

  return { url: session.url };
});

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = stripeClient();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata && session.metadata.invoiceId;
      const studentId = session.metadata && session.metadata.studentId;

      if (invoiceId) {
        try {
          await db.runTransaction(async (tx) => {
            const ref = db.collection('invoices').doc(invoiceId);
            const snap = await tx.get(ref);
            if (!snap.exists) return;
            const inv = snap.data();
            const paidAmount = Math.min(
              Number(inv.amount),
              Number(inv.paidAmount || 0) + session.amount_total / 100
            );
            tx.update(ref, {
              paidAmount,
              method: 'Card (Stripe)',
              paidDate: new Date().toISOString().slice(0, 10),
            });
            // Audit trail only — never synced to the client's local data
            // model or written to by any client, so it can't be tampered
            // with or accidentally wiped by the app's generic sync logic.
            tx.set(db.collection('stripePayments').doc(session.id), {
              invoiceId,
              studentId: studentId || inv.studentId,
              amount: session.amount_total / 100,
              sessionId: session.id,
              status: 'completed',
              createdAt: FieldValue.serverTimestamp(),
            });
          });
        } catch (e) {
          console.error('Failed to apply Stripe payment to invoice', invoiceId, e);
        }
      }
    }

    res.json({ received: true });
  }
);
