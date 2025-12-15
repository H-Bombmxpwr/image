export function wireTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs and panels
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      // Activate clicked tab and corresponding panel
      tab.classList.add('active');
      const panelId = 'panel-' + tab.dataset.panel;
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('active');
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
