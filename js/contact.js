(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  if (!form) return;
  var submit = document.getElementById('contact-submit');
  var status = document.getElementById('contact-status');
  var originalLabel = submit ? submit.textContent : 'Send message';

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.className = 'contact-status' + (kind ? ' is-' + kind : '');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }
    setStatus('Sending your message securely…', 'pending');
    var payload = {
      name: (form.elements.name.value || '').trim(),
      email: (form.elements.email.value || '').trim(),
      topic: (form.elements.topic.value || '').trim(),
      message: (form.elements.message.value || '').trim(),
      website: (form.elements.website.value || '').trim()
    };
    try {
      var response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.success) throw new Error(data.message || 'Your message could not be sent. Please try again later.');
      form.reset();
      setStatus('Thank you. Your message has been sent to the school team.', 'success');
    } catch (error) {
      setStatus(error && error.message ? error.message : 'Unable to send your message. Please try again later.', 'error');
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = originalLabel; }
    }
  });
})();
