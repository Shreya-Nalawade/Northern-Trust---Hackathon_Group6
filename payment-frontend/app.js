// API Configuration
const API_BASE_URL = 'http://localhost:3001/api/v1/payment';

// DOM Elements
const payBtn = document.getElementById('pay-btn-initiate');
const payBtnSpinner = document.getElementById('pay-btn-spinner');
const refOrderIdEl = document.getElementById('ref-order-id');
const logTerminal = document.getElementById('log-terminal');
const receiptCard = document.getElementById('receipt-card');
const receiptPayId = document.getElementById('receipt-pay-id');
const receiptOrderId = document.getElementById('receipt-order-id');
const receiptSignature = document.getElementById('receipt-signature');

// Stepper Elements
const steps = {
  1: document.getElementById('step-1'),
  2: document.getElementById('step-2'),
  3: document.getElementById('step-3'),
  4: document.getElementById('step-4'),
};

/**
 * Log message inside the custom mock terminal window.
 * @param {string} msg 
 * @param {'info' | 'success' | 'warning' | 'error' | 'muted'} type 
 */
function logToTerminal(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.textContent = `[${timestamp}] ${msg}`;
  logTerminal.appendChild(line);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

/**
 * Update the Stepper UI states.
 * @param {number} currentStep - The step index (1-4)
 * @param {'active' | 'completed' | 'failed' | 'idle'} state 
 */
function updateStepUI(currentStep, state) {
  const element = steps[currentStep];
  if (!element) return;

  element.classList.remove('active', 'completed', 'failed');

  if (state === 'active') {
    element.classList.add('active');
  } else if (state === 'completed') {
    element.classList.add('completed');
  } else if (state === 'failed') {
    element.classList.add('failed');
  }
}

/**
 * Resets all steps to idle state.
 */
function resetStepper() {
  for (let i = 1; i <= 4; i++) {
    steps[i].classList.remove('active', 'completed', 'failed');
  }
}

// Event Listeners
payBtn.addEventListener('click', startPaymentFlow);

/**
 * Main function managing the checkout process.
 */
async function startPaymentFlow() {
  try {
    // 1. Reset UI and logs
    payBtn.disabled = true;
    payBtnSpinner.style.display = 'inline-block';
    payBtn.querySelector('.btn-text').textContent = 'Processing...';
    receiptCard.style.display = 'none';
    resetStepper();
    
    logToTerminal('Initializing checkout sequence for amount: ₹10,000...', 'info');
    
    // 2. Create order on the backend
    updateStepUI(1, 'active');
    logToTerminal('POST /api/v1/payment/order - Sending request to Payment Microservice...', 'info');
    const urlParams = new URLSearchParams(window.location.search);
    const workflowExecutionId = urlParams.get('workflow_execution_id');

    const orderResponse = await fetch(`${API_BASE_URL}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        amount: 10000,
        workflow_execution_id: workflowExecutionId
      }),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok || !orderData.success) {
      updateStepUI(1, 'failed');
      throw new Error(orderData.error || 'Failed to create order on server.');
    }

    const { id: orderId, keyId } = orderData.data;
    
    updateStepUI(1, 'completed');
    logToTerminal(`Order created successfully. Razorpay Order ID: ${orderId}`, 'success');
    refOrderIdEl.textContent = orderId;

    if (!keyId || keyId === 'rzp_test_placeholder') {
      logToTerminal('Warning: Backend is using default or placeholder Key ID. Razorpay Modal may not load properly until you configure key ID inside payment-service/.env.', 'warning');
    }

    // 3. Configure Razorpay modal
    updateStepUI(2, 'active');
    logToTerminal('Opening Razorpay Checkout Modal...', 'info');

    const options = {
      key: keyId,
      amount: orderData.data.amount * 100, // amount in paise
      currency: orderData.data.currency,
      name: 'E-Commerce Orchestrator',
      description: 'Standard Order Bundle - ₹10,000',
      order_id: orderId,
      prefill: {
        name: 'John Doe',
        email: 'john.doe@northerntrust.com',
        contact: '9999999999'
      },
      theme: {
        color: '#4f46e5'
      },
      handler: async function (response) {
        // Modal completed payment successfully
        updateStepUI(2, 'completed');
        logToTerminal('Payment authorized by Razorpay.', 'success');
        
        // 4. Verify payment signature on backend
        updateStepUI(3, 'active');
        logToTerminal('POST /api/v1/payment/verify - Transmitting signatures for validation...', 'info');

        try {
          const verifyResponse = await fetch(`${API_BASE_URL}/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (!verifyResponse.ok || !verifyData.success) {
            updateStepUI(3, 'failed');
            throw new Error(verifyData.error || 'Signature validation failed.');
          }

          // 5. Verification Success
          updateStepUI(3, 'completed');
          updateStepUI(4, 'completed');
          logToTerminal('Payment verified! Signature matches key secret.', 'success');
          logToTerminal('=========================================', 'muted');
          logToTerminal(`PAYMENT SUCCESSFUL - transaction completed!`, 'success');
          
          // Populate Receipt
          receiptPayId.textContent = response.razorpay_payment_id;
          receiptOrderId.textContent = response.razorpay_order_id;
          receiptSignature.textContent = response.razorpay_signature;
          receiptCard.style.display = 'block';

          // Reset button state
          payBtn.disabled = false;
          payBtnSpinner.style.display = 'none';
          payBtn.querySelector('.btn-text').textContent = 'Pay Again (₹10,000)';

        } catch (err) {
          updateStepUI(3, 'failed');
          logToTerminal(`Verification Error: ${err.message}`, 'error');
          resetBtnState();
        }
      },
      modal: {
        ondismiss: function () {
          updateStepUI(2, 'failed');
          logToTerminal('Payment modal was closed/canceled by the user.', 'warning');
          resetBtnState();
        }
      }
    };

    // Open Razorpay Popup
    const rzp = new Razorpay(options);
    
    rzp.on('payment.failed', function (response) {
      updateStepUI(2, 'failed');
      logToTerminal(`Payment failed. Error Code: ${response.error.code}, Description: ${response.error.description}`, 'error');
      resetBtnState();
    });

    rzp.open();

  } catch (error) {
    logToTerminal(`Process Failed: ${error.message}`, 'error');
    resetBtnState();
  }
}

/**
 * Resets the button UI state in case of failure or cancellation.
 */
function resetBtnState() {
  payBtn.disabled = false;
  payBtnSpinner.style.display = 'none';
  payBtn.querySelector('.btn-text').textContent = 'Initiate Payment (₹10,000)';
}
