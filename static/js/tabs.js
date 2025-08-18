export function wireTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('show'));
      btn.classList.add('active');
      const target = document.getElementById('panel-' + btn.dataset.panel);
      if (target) target.classList.add('show');
    });
  });
}
