export function setActivePanel(panelName) {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');

  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.panel === panelName);
  });
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${panelName}`);
  });
}

export function wireTabs() {
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('imagelab:before-panel-change', {
        detail: { panel: tab.dataset.panel }
      }));
      setActivePanel(tab.dataset.panel);
    });
  });
  
  // Accordion toggles
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const accordion = header.closest('.accordion');
      if (accordion) {
        accordion.classList.toggle('open');
      }
    });
  });
  
  // Metadata panel toggle
  const metadataToggle = document.getElementById('metadataToggle');
  const metadataPanel = document.getElementById('metadataPanel');
  
  metadataToggle?.addEventListener('click', () => {
    metadataPanel?.classList.toggle('open');
  });
}
