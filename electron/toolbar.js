(() => {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      if (action) window.snapxToolbar.action(action);
    });
  });
})();
