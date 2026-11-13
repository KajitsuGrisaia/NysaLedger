(() => {
 const query=new URL(location.href).searchParams;
 const designs=['orbit','aurora','terminal','eclipse'];
 let design=query.get('design'),mode=query.get('mode');
 try{if(!designs.includes(design))design=localStorage.getItem('nysasoft-theme');if(!['dark','light'].includes(mode))mode=localStorage.getItem('nysasoft-appearance')||localStorage.getItem('nysa-theme');}catch{}
 document.documentElement.dataset.design=designs.includes(design)?design:'orbit';
 document.documentElement.dataset.theme=mode==='light'?'light':'dark';
})();
