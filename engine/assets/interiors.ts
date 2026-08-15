/**
 * Interiors — Decoration, Furniture, Architecture and the RoomAssembler that fills rooms.
 */
import * as THREE from 'three';
import { CITY_THEME } from '../theme';
import { InhabitantState } from './types';
import { sharedMaterials, getMaterial, getCachedGeometry } from './materials';
import { createWireframeObject, createSolidObject } from './primitives';
import { Props } from './Props';
import { Life } from './Life';

export const Decoration = {
    createPainting: (): THREE.Group => {
        const g = new THREE.Group();
        const frame = createSolidObject(1, 0.8, 0.05, getMaterial(CITY_THEME.colors.props.wood, false), 'box');
        const art = createSolidObject(0.8, 0.6, 0.06, getMaterial(Math.random() * 0xffffff, false), 'box');
        g.add(frame, art);
        return g;
    },
    createBookshelf: (): THREE.Group => {
        const g = new THREE.Group();
        const shelf = createWireframeObject(1.5, 2, 0.4, CITY_THEME.colors.props.wood, 0.6);
        g.add(shelf);
        for(let i=0; i<10; i++) {
            const book = createSolidObject(0.1, 0.2 + Math.random()*0.1, 0.3, getMaterial(Math.random()*0xffffff, false));
            book.position.set(-0.6 + Math.random()*1.2, -0.5 + Math.random()*1.5, 0);
            g.add(book);
        }
        return g;
    },
    createCeilingLight: (): THREE.Group => {
        const g = new THREE.Group();
        const cord = createWireframeObject(0.05, 0.5, 0.05, 0x333333);
        const bulb = createSolidObject(0.3, 0.2, 0.3, sharedMaterials.lampLight, 'box');
        bulb.position.y = -0.3;
        g.add(cord, bulb);
        return g;
    }
};


export const Furniture = {
    createChair: (): THREE.Group => { const g=new THREE.Group(); const s=createWireframeObject(0.5,0.1,0.5,0xffffff,0.5); s.position.y=0.5; g.add(s); const b=createWireframeObject(0.5,0.6,0.1,0xffffff,0.5); b.position.set(0,0.8,-0.2); g.add(b); [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]].forEach(p=>{ const l=createWireframeObject(0.05,0.5,0.05,0xffffff); l.position.set(p[0],0.25,p[1]); g.add(l); }); return g; },
    createRetailShelf: (): THREE.Group => { const g=new THREE.Group(); const s=createWireframeObject(2,1.8,0.5,CITY_THEME.colors.props.wood,0.4); s.position.y=0.9; g.add(s); for(let i=0;i<12;i++){ const sz=0.2+Math.random()*0.15; const c=Math.random()>0.5?0xff0000:(Math.random()>0.5?0x00ff00:0x0000ff); const p=createWireframeObject(sz,sz,sz,c,0.8); p.position.set(-0.7+(i%4)*0.5,0.4+Math.floor(i/4)*0.5,0); g.add(p); } return g; },
    createDetailedKitchen: (): THREE.Group => { const g=new THREE.Group(); const c=0xcccccc; const ctr=createWireframeObject(4,1,1.2,c,0.3); ctr.position.set(0,0.5,0); g.add(ctr); const snk=createWireframeObject(1,0.2,0.8,0x336699,0.6); snk.position.set(-1.2,1.05,0); g.add(snk); const tap=createWireframeObject(0.1,0.3,0.1,0xffffff); tap.position.set(-1.2,1.2,-0.2); g.add(tap); const stv=createWireframeObject(1,1.05,1,0x222222,0.8); stv.position.set(0.5,0.5,0); g.add(stv); [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]].forEach(p=>{ const b=createWireframeObject(0.2,0.05,0.2,0xff3300,0.8,'cylinder'); b.position.set(0.5+p[0],1.05,p[1]); g.add(b); }); const ovh=createWireframeObject(4,0.8,0.6,c,0.3); ovh.position.set(0,2.2,-0.2); g.add(ovh); const fr=createWireframeObject(1,2.5,1,0xffffff,0.4); fr.position.set(2.6,1.25,0); const hnd=createWireframeObject(0.05,0.5,0.05,0xaaaaaa); hnd.position.set(2.6-0.4,1.4,0.52); g.add(fr,hnd); return g; },
    createCornerDesk: (): THREE.Group => { const g=new THREE.Group(); const c=0x333333; const m=createWireframeObject(2,0.1,0.8,c,0.5); m.position.set(0,1.1,0); const s=createWireframeObject(0.8,0.1,1.5,c,0.5); s.position.set(1,1.1,0.7); const l1=createWireframeObject(0.1,1.1,0.1,0xaaaaaa); l1.position.set(-0.9,0.55,-0.3); const l2=createWireframeObject(0.1,1.1,0.1,0xaaaaaa); l2.position.set(1,0.55,1.4); const l3=createWireframeObject(0.1,1.1,0.1,0xaaaaaa); l3.position.set(-0.9,0.55,0.3); g.add(m,s,l1,l2,l3); return g; },
    createSectionalSofa: (): THREE.Group => { const g=new THREE.Group(); const c=0xcc4444; const ms=createWireframeObject(3,0.5,1,c,0.4); ms.position.set(0,0.25,0); const mb=createWireframeObject(3,0.8,0.2,c,0.4); mb.position.set(0,0.65,-0.5); const ss=createWireframeObject(1,0.5,2,c,0.4); ss.position.set(1,0.25,1); g.add(ms,mb,ss); return g; },
    createCoffeeTable: (): THREE.Group => { const g=new THREE.Group(); const t=createWireframeObject(1.2,0.05,0.8,CITY_THEME.colors.buildings.glass,0.2); t.position.y=0.6; const f=createWireframeObject(1.1,0.6,0.7,0xaaaaaa,0.8,'box'); f.position.y=0.3; g.add(t,f); return g; },
    
    // Updated TV to have an animated screen
    createTV: (): { group: THREE.Group, screen: THREE.Mesh } => { 
        const g=new THREE.Group(); 
        const c=createWireframeObject(2,0.5,0.5,0x333333,0.5); c.position.y=0.25; g.add(c); 
        const sf=createWireframeObject(1.8,1,0.1,0x111111,0.9); sf.position.set(0,1,0); 
        
        // Screen with emissive material
        const screenGeo = getCachedGeometry(1.7, 0.9, 0.05, 'box');
        // Clone material so it can be animated independently
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: false }); 
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0,1,0.02); 
        
        g.add(sf, screen); 
        return { group: g, screen: screen }; 
    },
    
    // Updated Computer to have an animated screen
    createComputer: (): { group: THREE.Group, screen: THREE.Mesh } => { 
        const g=new THREE.Group(); 
        const m=createWireframeObject(0.6,0.4,0.05,0x333333,0.8); m.position.set(0,0.35,-0.2); 
        
        // Screen
        const screenGeo = getCachedGeometry(0.5, 0.3, 0.05, 'box');
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(0, 0.35, -0.19);

        const s=createWireframeObject(0.1,0.2,0.1,0xaaaaaa); s.position.set(0,0.1,-0.2); 
        const k=createWireframeObject(0.5,0.02,0.2,0x555555); k.position.set(0,0.02,0.1); 
        g.add(m, screen, s, k); 
        return { group: g, screen: screen }; 
    },
    
    createRug: (w: number, d: number, c: number): THREE.Group => { const r=createSolidObject(w,0.04,d,getMaterial(c, false), 'box'); r.position.y=0.02; return r; },
    createBathroom: (): THREE.Group => { const g=new THREE.Group(); const sb=createWireframeObject(1.2,0.1,1.2,0xffffff,0.5); sb.position.set(-0.8,0.05,-0.8); const sg=createWireframeObject(1.1,2.2,0.05,0xccffff,0.2); sg.position.set(-0.8,1.15,-0.25); const sgs=createWireframeObject(0.05,2.2,1.1,0xccffff,0.2); sgs.position.set(-0.25,1.15,-0.8); g.add(sb,sg,sgs); const tb=createWireframeObject(0.4,0.4,0.5,0xffffff,0.8); tb.position.set(0.8,0.2,-0.8); const tt=createWireframeObject(0.4,0.6,0.2,0xffffff,0.8); tt.position.set(0.8,0.7,-1); g.add(tb,tt); const sc=createWireframeObject(0.7,0.8,0.5,0xaaaaaa,0.5); sc.position.set(0.8,0.4,0.8); g.add(sc); return g; },
    createBed: (d: boolean = false): THREE.Group => { const g=new THREE.Group(); const s=Math.random(); const c=0x3366ff; const w=d?2.4:1.4; const l=3; const m=createWireframeObject(w,0.5,l,c,0.2); m.position.y=0.35; g.add(m); if(s<0.33){ const h=createWireframeObject(w,1.2,0.1,0x555555); h.position.set(0,0.6,-l/2); g.add(h); } else if(s<0.66){ const p=createWireframeObject(w+0.2,0.2,l+0.2,0x333333); p.position.y=0.1; g.add(p); } else { const h=2.2; const p1=createWireframeObject(0.05,h,0.05,0xffffff); p1.position.set(-w/2,h/2,-l/2); const p2=createWireframeObject(0.05,h,0.05,0xffffff); p2.position.set(w/2,h/2,-l/2); const p3=createWireframeObject(0.05,h,0.05,0xffffff); p3.position.set(-w/2,h/2,l/2); const p4=createWireframeObject(0.05,h,0.05,0xffffff); p4.position.set(w/2,h/2,l/2); g.add(p1,p2,p3,p4); const t=createWireframeObject(w,0.05,l,0xffffff,0.1); t.position.y=h; g.add(t); } const pw=d?1:0.8; const pl=createWireframeObject(pw,0.2,0.5,0xffffff,0.5); pl.position.set(d?-0.6:0,0.7,-l/2+0.5); g.add(pl); if(d){ const pr=createWireframeObject(pw,0.2,0.5,0xffffff,0.5); pr.position.set(0.6,0.7,-l/2+0.5); g.add(pr); } return g; },
    createTableSet: (): THREE.Group => { const g=new THREE.Group(); const c=CITY_THEME.colors.props.wood; if(Math.random()>0.5){ const t=createWireframeObject(2.5,0.1,1.5,c,0.4); t.position.y=1.1; g.add(t); [[-1.1,-0.6],[1.1,-0.6],[-1.1,0.6],[1.1,0.6]].forEach(p=>{ const l=createWireframeObject(0.1,1.1,0.1,c); l.position.set(p[0],0.55,p[1]); g.add(l); }); } else { const t=createWireframeObject(1.4,0.1,1.4,c,0.4,'cylinder'); t.position.y=1.1; g.add(t); const b=createWireframeObject(0.15,1.1,0.15,c,0.8,'cylinder'); b.position.y=0.55; g.add(b); const f=createWireframeObject(0.7,0.1,0.7,c,0.8,'cylinder'); f.position.y=0.05; g.add(f); } return g; }
};


export const Architecture = {
    createDoor: (): THREE.Group => { const g=new THREE.Group(); const c=0xffffff; const fL=createWireframeObject(0.1,2.2,0.1,c,0.8); fL.position.set(-0.5,1.1,0); const fR=createWireframeObject(0.1,2.2,0.1,c,0.8); fR.position.set(0.5,1.1,0); const fT=createWireframeObject(1.1,0.1,0.1,c,0.8); fT.position.set(0,2.15,0); g.add(fL,fR,fT); const p=createWireframeObject(0.9,2.1,0.05,0xaaaaaa,0.3); p.position.set(0.45,1.05,0); const pg=new THREE.Group(); pg.position.set(-0.45,0,0); pg.add(p); pg.rotation.y=Math.PI/4; const h=createWireframeObject(0.05,0.15,0.02,0xffff00,1); h.position.set(0.8,1,0.05); p.add(h); g.add(pg); return g; },
    createSlidingDoor: (): THREE.Group => { const g=new THREE.Group(); const f=createWireframeObject(2,2.2,0.1,0xffffff,0.5); f.position.y=1.1; g.add(f); const gl=createWireframeObject(0.9,2,0.05,CITY_THEME.colors.buildings.glass,0.3); gl.position.set(-0.45,1.1,0); g.add(gl); const gr=createWireframeObject(0.9,2,0.05,CITY_THEME.colors.buildings.glass,0.3); gr.position.set(0.45,1.1,0.05); g.add(gr); return g; },
    createElevator: (): THREE.Group => { const g=new THREE.Group(); const f=createWireframeObject(1.5,2.2,0.2,0x888888,0.8); f.position.y=1.1; g.add(f); const dL=createWireframeObject(0.6,2.1,0.05,0xcccccc,0.9); dL.position.set(-0.35,1.05,0.05); g.add(dL); const dR=createWireframeObject(0.6,2.1,0.05,0xcccccc,0.9); dR.position.set(0.35,1.05,0.05); g.add(dR); const b=createWireframeObject(0.1,0.2,0.05,0x00ff00,1); b.position.set(0.9,1.1,0.1); g.add(b); return g; },
    createStairs: (): THREE.Group => { const g=new THREE.Group(); const c=8; const h=3.5/c; for(let i=0;i<c;i++){ const s=createWireframeObject(1,0.1,0.3,0xffffff,0.5); const a=i*0.2; s.position.set(Math.sin(a)*0.5,i*h,Math.cos(a)*0.5); s.rotation.y=a; g.add(s); const p=createWireframeObject(0.05,1,0.05,0xaaaaaa); p.position.set(Math.sin(a)*0.5+0.4,i*h+0.5,Math.cos(a)*0.5); g.add(p); } return g; },
    createStraightStairs: (height: number, width: number, depth: number): THREE.Group => {
        const g = new THREE.Group();
        const steps = 10;
        const stepHeight = height / steps;
        const stepDepth = depth / steps;
        for(let i=0; i<steps; i++) {
            const s = createSolidObject(width, 0.1, stepDepth, getMaterial(CITY_THEME.colors.props.wood, false), 'box');
            s.position.set(0, i * stepHeight + stepHeight/2, i * stepDepth - depth/2);
            g.add(s);
        }
        // Railing
        const railL = createWireframeObject(0.05, height, depth, 0xaaaaaa, 0.5, 'box');
        railL.position.set(-width/2, height/2, 0);
        g.add(railL);
        return g;
    },
    createBalcony: (width: number, type: 'simple' | 'glass' | 'green'): THREE.Group => { const g=new THREE.Group(); const d=1.5; const h=1; const f=createWireframeObject(width,0.1,d,0x333333,0.6); f.position.set(0,0,d/2); g.add(f); const bm=0x555555; const b1=createWireframeObject(0.1,0.7,0.7,bm,0.8); b1.position.set(-width/2+0.2,-0.35,0.35); b1.rotation.x=Math.PI/4; g.add(b1); const b2=createWireframeObject(0.1,0.7,0.7,bm,0.8); b2.position.set(width/2-0.2,-0.35,0.35); b2.rotation.x=Math.PI/4; g.add(b2); const rm=type==='glass'?CITY_THEME.colors.buildings.glass:0xffffff; const ro=type==='glass'?0.3:0.6; const fr=createWireframeObject(width,h,0.05,rm,ro); fr.position.set(0,h/2,d); g.add(fr); const l=createWireframeObject(0.05,h,d,rm,ro); l.position.set(-width/2,h/2,d/2); g.add(l); const r=createWireframeObject(0.05,h,d,rm,ro); r.position.set(width/2,h/2,d/2); g.add(r); if(type==='green'){ const p1=Props.createPlant(0.7); p1.position.set(-width/3,0.5,d-0.3); g.add(p1); const p2=Props.createPlant(1.5); p2.position.set(width/3,0.5,d-0.3); g.add(p2); } else if(type==='simple' && Math.random()>0.5){ const c=Furniture.createChair(); c.scale.set(0.8,0.8,0.8); c.position.set(0,0.2,d/2); c.rotation.y=Math.PI; g.add(c); } return g; },
    createWall: (w: number, h: number, d: number = 0.2): THREE.Group => createWireframeObject(w,h,d,0xffffff,0.5),
    createRooftopDetail: (w: number, d: number, shape: 'box' | 'cylinder' | 'icosahedron' = 'box'): THREE.Group => {
        const g = new THREE.Group();
        if (shape === 'icosahedron') {
             const dome = createWireframeObject(w, w/2, d, 0xaaaaaa, 0.4, 'icosahedron'); 
             dome.position.y = w/4;
             const ant = createWireframeObject(0.1, 3, 0.1, 0xffff00, 0.8);
             ant.position.y = w/2 + 1.5;
             g.add(dome, ant);
             return g;
        }
        if (shape === 'cylinder') {
             const dome = createWireframeObject(w*0.8, w*0.4, d*0.8, 0xaaaaaa, 0.4, 'icosahedron'); 
             dome.position.y = w*0.2; 
             const ant = createWireframeObject(0.1, 4, 0.1, 0xff0000, 0.8);
             ant.position.y = w*0.4 + 2;
             g.add(dome, ant);
             return g;
        }
        const type = Math.floor(Math.random() * 6);
        if (type === 0) { const h = createWireframeObject(w/2, 2, d/2, 0x555555, 0.2, shape); h.position.y = 1; g.add(h); const a = createWireframeObject(0.1, 4, 0.1, 0xff0000); a.position.set(0, 3, 0); g.add(a); }
        else if (type === 1) { const h = createSolidObject(Math.min(w,d)*0.8, 0.1, Math.min(w,d)*0.8, getMaterial(0x333333, false), shape === 'box' ? 'cylinder' : shape); h.position.y = 0.1; g.add(h); const H = createWireframeObject(Math.min(w,d)*0.5, 0.05, Math.min(w,d)*0.5, 0xffff00, 0.8, shape); H.position.y = 0.2; g.add(H); }
        else if (type === 2) { const ac1 = createWireframeObject(2, 1.5, 2, 0xaaaaaa); ac1.position.set(-w/4, 0.75, -d/4); g.add(ac1); const ac2 = createWireframeObject(1.5, 1.5, 1.5, 0xaaaaaa); ac2.position.set(w/4, 0.75, d/4); g.add(ac2); const fan = createWireframeObject(1, 0.5, 1, 0x333333, 0.5, 'cylinder'); fan.position.set(w/4, 1.5, d/4); g.add(fan); }
        else if (type === 3) { const p1 = Props.createPlant(2); p1.position.set(-w/3, 0, -d/3); g.add(p1); const p2 = Props.createPlant(1.5); p2.position.set(w/3, 0, d/3); g.add(p2); const b = Furniture.createChair(); b.scale.set(1.5,1.5,1.5); b.position.set(0, 0, 0); g.add(b); }
        else if (type === 4) { const base = createWireframeObject(w*0.3, 0.5, d*0.3, 0x888888, 0.5, shape); base.position.y = 0.25; const ant = createWireframeObject(0.1, 6, 0.1, 0xff0000, 0.8); ant.position.y = 3; g.add(base, ant); }
        else { const dome = createWireframeObject(w*0.6, w*0.3, d*0.6, 0xaaaaaa, 0.4, 'icosahedron'); dome.position.y = w*0.15; g.add(dome); }
        return g;
    }
};


export const RoomAssembler = {
    fillRoom: (group: THREE.Group, type: 'bedroom' | 'living' | 'kitchen' | 'office' | 'empty', w: number, d: number, inhabitants: any[], animatedObjects: { fans: THREE.Group[], screens: THREE.Mesh[] }) => {
        if (Math.random() > 0.3) {
            const rugColor = Math.random() > 0.5 ? 0x224477 : (Math.random() > 0.5 ? 0x772222 : 0x227722);
            const rug = Furniture.createRug(w * 0.6, d * 0.6, rugColor);
            group.add(rug);
        }
        
        // Ceiling Light or Fan
        if (Math.random() > 0.2) {
            if (type === 'living' && Math.random() > 0.4) {
                const fanData = Props.createCeilingFan();
                fanData.group.position.y = 2.5;
                group.add(fanData.group);
                animatedObjects.fans.push(fanData.blades);
            } else {
                const light = Decoration.createCeilingLight();
                light.position.y = 2.5;
                group.add(light);
            }
        }
        
        if (w > 4) {
            if (Math.random() > 0.5) {
                const art = Decoration.createPainting();
                art.position.set(0, 1.5, -d/2 + 0.1);
                group.add(art);
            }
            if (Math.random() > 0.7) {
                const shelf = Decoration.createBookshelf();
                shelf.position.set(-w/2 + 0.5, 1, 0);
                shelf.rotation.y = Math.PI / 2;
                group.add(shelf);
            }
        }
        if (type === 'bedroom') {
            const isDouble = w > 6;
            const bed = Furniture.createBed(isDouble);
            bed.position.set(-w/4, 0, -d/4);
            group.add(bed);
            if (w > 5) {
                const desk = Furniture.createComputer();
                desk.group.position.set(w/3, 0.5, d/3);
                desk.group.rotation.y = Math.PI;
                group.add(desk.group);
                animatedObjects.screens.push(desk.screen);
            }
            if (Math.random() > 0.6) {
                const p = Life.createInhabitant(InhabitantState.SLEEPING);
                p.position.copy(bed.position); 
                // Adjust for bed height
                p.position.y += 0.4;
                group.add(p); inhabitants.push(p);
            } else if (w > 6 && Math.random() > 0.5) {
                // Add Pacing Character in big bedrooms
                const p = Life.createInhabitant(InhabitantState.PACING);
                p.position.set(w/4, 0, 0);
                group.add(p); inhabitants.push(p);
            }
        } 
        else if (type === 'living') {
            const sofa = Furniture.createSectionalSofa();
            sofa.position.set(-w/4, 0, -d/4);
            group.add(sofa);
            const tv = Furniture.createTV();
            tv.group.position.set(w/4, 0, d/4);
            tv.group.rotation.y = Math.PI;
            group.add(tv.group);
            animatedObjects.screens.push(tv.screen);

            const table = Furniture.createCoffeeTable();
            table.position.set(0, 0, 0);
            group.add(table);
            if (Math.random() > 0.5) {
                const p = Life.createInhabitant(InhabitantState.SITTING);
                p.position.copy(sofa.position); p.position.x += 0.5; p.position.z += 0.5;
                group.add(p); inhabitants.push(p);
            } else if (Math.random() > 0.4) {
                // Add Pacing Character
                const p = Life.createInhabitant(InhabitantState.PACING);
                p.position.set(0, 0, d/4);
                group.add(p); inhabitants.push(p);
            }
        }
        else if (type === 'kitchen') {
            const kitchen = Furniture.createDetailedKitchen();
            kitchen.position.set(0, 0, -d/3);
            group.add(kitchen);
            const table = Furniture.createTableSet();
            table.position.set(0, 0, d/3);
            group.add(table);
        }
        else if (type === 'office') {
            const deskCount = Math.max(1, Math.floor(w / 4));
            for(let i=0; i<deskCount; i++) {
                const desk = Furniture.createCornerDesk();
                desk.position.set((i - deskCount/2) * 3, 0, 0);
                if (Math.random() > 0.5) desk.rotation.y = Math.PI;
                group.add(desk);
                if(Math.random() > 0.7) {
                    // Create working inhabitant
                    const p = Life.createInhabitant(InhabitantState.WORKING);
                    p.position.copy(desk.position); p.position.z -= 0.5;
                    group.add(p); inhabitants.push(p);
                }
            }
        }
    }
};


