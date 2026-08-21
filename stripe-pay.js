/* ==========================================================================
   Brightwood HSMS — Card & Google Pay checkout (Stripe, via Firebase
   Cloud Functions)

   This is the thinnest possible client for a real, PCI-compliant card
   payment: the app never touches a card number at all. It just asks the
   `createCheckoutSession` Cloud Function (see /functions/index.js) for a
   Stripe-hosted checkout URL, and sends the parent's browser there — card
   entry, 3-D Secure, and Google Pay/Apple Pay all happen on Stripe's own
   page. The Cloud Functions webhook is what actually marks the invoice
   paid once Stripe confirms the charge, never this file.

   SETUP REQUIRED (see README.md -> "Card & Google Pay Setup (Stripe)"):
   deploy /functions, register its webhook URL with Stripe, then flip
   ENABLED to true below. Until then this stays inactive and the "Pay Now"
   screen just shows Mobile Money / Bank Transfer, which needs no setup.
   ========================================================================== */

const STRIPE_CONFIG = {
  ENABLED: false,
  // Only change this if you deployed the Cloud Functions to a region other
  // than the default (us-central1) — e.g. 'europe-west1'.
  FUNCTIONS_REGION: 'us-central1',
};

const StripePay = {
  isConfigured() {
    return !!(
      STRIPE_CONFIG.ENABLED &&
      typeof FB !== 'undefined' && FB.active &&
      typeof firebase !== 'undefined' && firebase.functions
    );
  },

  async payInvoice(invoice, errorEl) {
    if (errorEl) { errorEl.classList.add('hidden'); errorEl.textContent = ''; }
    const btn = document.getElementById('stripePayBtn');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to secure checkout…'; }

    try {
      const createCheckoutSession = firebase.app().functions(STRIPE_CONFIG.FUNCTIONS_REGION).httpsCallable('createCheckoutSession');
      const result = await createCheckoutSession({ invoiceId: invoice.id });
      if (result && result.data && result.data.url) {
        window.location.href = result.data.url;
      } else {
        throw new Error('No checkout URL was returned.');
      }
    } catch (e) {
      console.error('Stripe checkout failed:', e);
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
      if (errorEl) {
        errorEl.textContent = (e && e.message) || 'Could not start checkout — please try Mobile Money / Bank Transfer instead.';
        errorEl.classList.remove('hidden');
      }
    }
  },
};

// If the browser just came back from a Stripe redirect, let the parent know
// what happened (the invoice itself updates automatically once the webhook
// runs — usually within a few seconds — via the normal Firestore listener).
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('stripe') === 'success') {
    toast('Payment received — your invoice will update shortly.');
  } else if (params.get('stripe') === 'cancelled') {
    toast('Checkout was cancelled — no payment was made.');
  }
  if (params.has('stripe')) {
    params.delete('stripe');
    const clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', clean);
  }
});
