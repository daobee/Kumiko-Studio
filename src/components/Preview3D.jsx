import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { displayGeometry } from '../data/export.js';

const FOV = 26;

function sceneXY(x, y, bb) {
  return [x - (bb.minX + bb.w / 2), (bb.minY + bb.h / 2) - y];
}

export default function Preview3D({
  project, layout, mini = false, interactive = true,
  screenshotSignal = 0, onFps, className = ''
}) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(0);
  const S = useRef({});
  const scr = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mini ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.shadowMap.enabled = !mini;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 60000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;

    const hemi = new THREE.HemisphereLight(0xfff8ec, 0x6b5b40, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff0d4, 1.2);
    key.position.set(500, 700, 1200);
    key.castShadow = !mini;
    key.shadow.mapSize.set(mini ? 512 : 1536, mini ? 512 : 1536);
    key.shadow.bias = -0.0005;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.24);
    fill.position.set(-700, -200, 700);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd7a0, 0.4);
    rim.position.set(0, 300, -800);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xb98d5c, roughness: 0.72, metalness: 0.02 });
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.02 });
    const bgMat = new THREE.MeshStandardMaterial({ color: 0xf1e4c8, roughness: 1, metalness: 0 });
    S.current = {
      renderer, scene, camera, controls, root, hemi, key, fill, rim,
      frameMat, stickMat, plateMat, bgMat,
      group: null, cameraGoal: null, bbox: null, fps: 0, frames: 0, lastT: performance.now(),
      disposed: false
    };
    setReady(x => x + 1);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0;
    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      const st = S.current;
      if (st.cameraGoal) {
        camera.position.lerp(st.cameraGoal, 0.12);
        if (camera.position.distanceTo(st.cameraGoal) < 1.2) {
          camera.position.copy(st.cameraGoal);
          st.cameraGoal = null;
        }
        camera.lookAt(0, 0, 0);
      }
      controls.update();
      renderer.render(scene, camera);
      st.frames++;
      const now = performance.now();
      if (now - st.lastT > 900) {
        st.fps = Math.round(st.frames * 1000 / (now - st.lastT));
        st.frames = 0; st.lastT = now;
        if (!mini) onFps?.(st.fps);
      }
      if (scr.current) {
        scr.current = false;
        try {
          const url = renderer.domElement.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(project.name || 'kumiko').replace(/[^\w一-龥-]/g, '_')}-3d.png`;
          a.click();
        } catch {}
      }
    };
    tick();
    controls.addEventListener('start', () => { S.current.cameraGoal = null; });
    S.current.resize = resize;
    return () => {
      disposed = true;
      S.current.disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      frameMat.dispose(); stickMat.dispose(); plateMat.dispose(); bgMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  // build panel
  useEffect(() => {
    const st = S.current;
    if (!st || st.disposed || !layout) return;
    if (st.group) {
      st.root.remove(st.group);
      st.group.traverse(o => {
        if (o.isMesh || o.isInstancedMesh) {
          o.geometry?.dispose?.();
          const keep = o.material === st.stickMat || o.material === st.bgMat || o.material === st.frameMat;
          if (!keep) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose?.();
          }
        }
      });
    }
    const group = new THREE.Group();
    st.group = group;
    st.root.add(group);

    const bb = layout.bbox;
    st.bbox = bb;
    const cx = bb.minX + bb.w / 2, cy = bb.minY + bb.h / 2;
    const toScene = (x, y) => [x - cx, cy - y];
    const g = displayGeometry(project, layout);

    // frame ring
    if (layout.outer?.length >= 3 && layout.inner?.length >= 3) {
      try {
        const shape = new THREE.Shape(layout.outer.map(([x, y]) => new THREE.Vector2(...toScene(x, y))));
        shape.holes.push(new THREE.Path(layout.inner.map(([x, y]) => new THREE.Vector2(...toScene(x, y)))));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: project.grid.depth, bevelEnabled: false, curveSegments: 1 });
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: g.frame.color, roughness: 0.72, metalness: 0.02 }));
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
      } catch {}
    }

    // ribs / borders as instanced boxes
    const segs = g.segments;
    if (segs.length) {
      const unit = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.InstancedMesh(unit, st.stickMat, segs.length);
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const zAxis = new THREE.Vector3(0, 0, 1);
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const col = new THREE.Color();
      const rib = project.grid.rib;
      const th = project.grid.insertThickness;
      segs.forEach((s, i) => {
        const [x1, y1] = toScene(s.x1, s.y1);
        const [x2, y2] = toScene(s.x2, s.y2);
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 0.1;
        pos.set((x1 + x2) / 2, (y1 + y2) / 2, th / 2);
        q.setFromAxisAngle(zAxis, Math.atan2(dy, dx));
        scl.set(len + rib * 0.7, rib, th);
        mtx.compose(pos, q, scl);
        mesh.setMatrixAt(i, mtx);
        mesh.setColorAt(i, col.set(s.color));
      });
      mesh.count = segs.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      group.add(mesh);
    }

    // solid plates
    for (const plate of g.plates) {
      try {
        const shape = new THREE.Shape(plate.poly.map(([x, y]) => new THREE.Vector2(...toScene(x, y))));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: project.grid.insertThickness, bevelEnabled: false, curveSegments: 1 });
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: plate.color, roughness: 0.8, metalness: 0.02 }));
        mesh.castShadow = true;
        group.add(mesh);
      } catch {}
    }

    // background / backlight plane
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(bb.w, bb.h), st.bgMat);
    bg.position.z = -project.grid.backgroundThickness - 25;
    bg.receiveShadow = !mini;
    group.add(bg);

    // camera fit
    const dist = Math.max(bb.h * 1.25, bb.w * 1.25) / (2 * Math.tan((FOV / 2) * Math.PI / 180));
    st.dist = dist;
    st.cameraGoal = null;
    setView(st, project.preview.view || 'iso', true);
    if (mini) st.controls.enabled = false; else st.controls.enabled = interactive;
    st.resize?.();
    applyLook(st, project);
  }, [ready, layout]);

  useEffect(() => {
    const st = S.current;
    if (st && st.controls) st.controls.enabled = mini ? false : interactive;
  }, [interactive, mini, ready]);

  useEffect(() => {
    const st = S.current;
    if (!st || st.disposed) return;
    applyLook(st, project);
  }, [ready, project.preview.material, project.preview.light, project.preview.backlight, project.preview.intensity, project.preview.temp, project.preview.view]);

  useEffect(() => { if (screenshotSignal > 0) scr.current = true; }, [screenshotSignal]);

  return <div ref={hostRef} className={'canvas-wrap ' + className} />;
}

function setView(st, view, immediate) {
  const d = st.dist || 1200;
  const p = view === 'front' ? new THREE.Vector3(0, 0, d)
    : view === 'side' ? new THREE.Vector3(d * 0.95, 0, d * 0.3)
      : view === 'top' ? new THREE.Vector3(0, d * 0.97, d * 0.12)
        : new THREE.Vector3(d * 0.64, d * 0.38, d * 0.74);
  if (immediate) {
    st.camera.position.copy(p);
    st.camera.lookAt(0, 0, 0);
    st.cameraGoal = null;
  } else st.cameraGoal = p;
}

function applyLook(st, project) {
  const pv = project.preview;
  const light = pv.light || 'day';
  const on = !!pv.backlight;
  const mat = pv.material || 'matte';
  st.stickMat.roughness = mat === 'silk' ? 0.38 : mat === 'translucent' ? 0.3 : mat === 'wood' ? 0.72 : 0.82;
  st.stickMat.metalness = mat === 'silk' ? 0.12 : 0.02;
  st.stickMat.transparent = mat === 'translucent';
  st.stickMat.opacity = mat === 'translucent' ? 0.86 : 1;
  st.stickMat.needsUpdate = true;
  if (light === 'night') {
    st.hemi.intensity = 0.08; st.key.intensity = 0.35; st.fill.intensity = 0.06; st.rim.intensity = 0.75;
    st.key.color.set(0xffd7a6); st.rim.color.set(0xffb36b);
    st.renderer.toneMappingExposure = 0.78;
    st.bgMat.color.set(0xb98a55);
  } else if (light === 'evening') {
    st.hemi.intensity = 0.3; st.key.intensity = 0.85; st.fill.intensity = 0.16; st.rim.intensity = 0.8;
    st.key.color.set(0xffd2a2); st.rim.color.set(0xffc08a);
    st.renderer.toneMappingExposure = 0.9;
    st.bgMat.color.set(0xe4c79b);
  } else {
    st.hemi.intensity = 0.55; st.key.intensity = 1.3; st.fill.intensity = 0.3; st.rim.intensity = 0.45;
    st.key.color.set(0xfff2dc); st.rim.color.set(0xffe4c0);
    st.renderer.toneMappingExposure = 0.96;
    st.bgMat.color.set(on ? 0xeedcbc : 0xece0c8);
  }
  st.bgMat.envMapIntensity = 0.12;
  st.bgMat.needsUpdate = true;
  setView(st, pv.view || 'iso', false);
}
