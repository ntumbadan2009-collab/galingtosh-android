import {test,expect} from '@playwright/test';

const api='https://lmlwekcytivszlszmfvy.supabase.co';
const userId='00000000-0000-4000-8000-000000000001';
const projectOne='00000000-0000-4000-8000-000000000002';
const projectTwo='00000000-0000-4000-8000-000000000003';
const session={
 access_token:'header.payload.signature',refresh_token:'test-refresh-token',
 token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,
 user:{id:userId,aud:'authenticated',role:'authenticated',email:'fixture@example.org',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-11-01T10:00:00Z'},
};
const projects=[
 {id:projectOne,title:'Documentaire sur l’espace',type:'custom',created_at:'2026-11-21T08:00:00Z',updated_at:'2026-11-22T09:00:00Z'},
 {id:projectTwo,title:'Cinéma et technologie',type:'custom',created_at:'2026-11-20T08:00:00Z',updated_at:'2026-11-21T09:00:00Z'},
];
const renders=[
 {id:'00000000-0000-4000-8000-000000000004',project_id:projectOne,film_version:1,status:'done',progress:100,output_path:userId+'/film.mp4',error:null,warnings:[],created_at:'2026-11-22T09:00:00Z'},
];
const assets=[
 {id:'00000000-0000-4000-8000-000000000005',project_id:projectOne,kind:'video',source:'search',storage_path:null,license:'Pixabay Content License',provenance:{title:'City at night',preview_url:'https://mock-assets.test/city.svg',author:'Example Contributor',url:'https://pixabay.com'},analysis:null},
 {id:'00000000-0000-4000-8000-000000000006',project_id:projectOne,kind:'image',source:'search',storage_path:null,license:'Pixabay Content License',provenance:{title:'Robot and technology',preview_url:'https://mock-assets.test/robot.svg',author:'Example Contributor',url:'https://pixabay.com'},analysis:null},
];
test.beforeEach(async({page})=>{
 await page.addInitScript(({storageKey,storedSession})=>{
  localStorage.setItem(storageKey,JSON.stringify(storedSession));
 },{storageKey:'sb-lmlwekcytivszlszmfvy-auth-token',storedSession:session});
 await page.route('https://mock-assets.test/**',async route=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#372447"/><circle cx="200" cy="150" r="90" fill="#8154B9"/></svg>';
  await route.fulfill({contentType:'image/svg+xml',body:svg,status:200});
 });
 await page.route(api+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/v1/user')){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session.user)});return;
  }
  const rows=path.endsWith('/projects')?projects:
   path.endsWith('/render_jobs')?renders:
   path.endsWith('/media_assets')?assets:
   path.endsWith('/conversations')?[]:
   path.endsWith('/production_missions')?null:
   path.endsWith('/films')?null:[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows),headers:{'content-range':'0-2/2'}});
 });
 await page.goto('/');
 await expect(page.locator('.shell')).toBeVisible({timeout:12000});
});

test('Android-style project list, real-status filters and full-width bottom navigation',async({page})=>{
 await page.getByRole('navigation',{name:'Navigation mobile'}).getByRole('button',{name:'Projets'}).click();
 await expect(page.getByRole('heading',{name:'Mes projets'})).toBeVisible();
 await expect(page.locator('.android-project-item')).toHaveCount(2);
 await expect(page.locator('.project-grid')).toHaveCount(0);
 await page.getByRole('button',{name:'Terminés'}).click();
 await expect(page.locator('.android-project-item')).toHaveCount(1);
 await page.getByRole('button',{name:'En cours'}).click();
 await expect(page.locator('.android-project-item')).toHaveCount(0);
 await page.getByRole('button',{name:'Tous',exact:true}).click();
 const nav=await page.locator('.mobile-nav').boundingBox();
 if(!nav)throw Error('Mobile tabs missing');
 expect(nav.width).toBeGreaterThan(350);
 expect(nav.y+nav.height).toBeGreaterThan(750);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(361);
 await page.screenshot({path:'test-results/projects-native-layout.png'});
});

test('Android media: finished videos as rows, actual assets in two-column thumbnail grid',async({page})=>{
 await page.getByRole('navigation',{name:'Navigation mobile'}).getByRole('button',{name:'Médias'}).click();
 await expect(page.getByRole('heading',{name:'Médias'})).toBeVisible();
 await expect(page.locator('.media-row')).toHaveCount(1);
 await expect(page.getByText('RESSOURCES')).toBeVisible();
 const cards=page.locator('.native-asset-card');
 await expect(cards).toHaveCount(2);
 await expect(page.locator('.native-asset-card img')).toHaveCount(2);
 const first=await cards.nth(0).boundingBox(),second=await cards.nth(1).boundingBox();
 if(!first||!second)throw Error('Media thumbnails not measurable');
 expect(Math.abs(first.y-second.y)).toBeLessThan(6);
 expect(first.width).toBeGreaterThan(125);
 expect(first.width).toBeLessThan(180);
 await cards.first().click();
 await expect(page.getByRole('dialog',{name:'Détails du média'})).toBeVisible();
 await expect(page.getByText('Pixabay Content License')).toBeVisible();
 await page.getByRole('button',{name:'Fermer'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(361);
 await page.screenshot({path:'test-results/media-native-layout.png'});
});

test('Studio remains intentionally empty, with Android brand mark and full-width composer',async({page})=>{
 await expect(page.getByRole('heading',{name:'Tout commence par une idée'})).toHaveCount(0);
 const logo=page.locator('.android-header .brand-icon svg path');
 await expect(logo).toHaveAttribute('d',/^M436,80H76/);
 const composer=await page.locator('.composer').boundingBox();
 if(!composer)throw Error('Studio composer not measurable');
 expect(composer.width).toBeGreaterThan(310);
 const nav=await page.locator('.mobile-nav').boundingBox();
 if(!nav)throw Error('Mobile tabs not visible');
 expect(nav.y+nav.height).toBeGreaterThan(750);
 await page.locator('#composer').focus();
 await expect(page.locator('.topbar.android-header')).toBeHidden();
 await expect(page.locator('.mobile-nav.android-tabs')).toBeHidden();
 await page.screenshot({path:'test-results/studio-keyboard-layout.png'});
});
