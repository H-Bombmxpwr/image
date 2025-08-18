// POST JSON helper
export async function postJSON(url, payload){
  const r = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  if(!r.ok){
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}
