(() => {
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.call-row button');if(!btn)return;
    const row=btn.closest('.call-row');const name=row?.querySelector('b')?.textContent?.trim();if(!name)return;
    const type=row.querySelector('span')?.textContent?.toLowerCase().includes('video')?'Video':'Voice';
    const chat=[...document.querySelectorAll('.chat-row .chat-main')].find(x=>x.innerText.includes(name));
    if(!chat)return;
    e.preventDefault();e.stopImmediatePropagation();chat.click();setTimeout(()=>document.querySelector(`.chat-actions [title="${type} call"]`)?.click(),250);
  },true);
})();
