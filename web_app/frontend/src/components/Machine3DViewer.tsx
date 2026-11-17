import React, { useEffect, useId, useRef, useState } from 'react';
import * as THREE from 'three';
import { animate as animateTween } from 'animejs';
import { Eye, RotateCcw, RotateCw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const cncParts = {
  tool: {
    name: 'Dao cắt',
    function: 'Dao cắt bỏ vật liệu khỏi phôi trong quá trình gia công.',
    input: 'Độ mòn dao (phút) là thông số đầu vào của mô hình.',
  },
  spindle: {
    name: 'Trục chính',
    function: 'Trục chính giữ và quay dao cắt.',
    input: 'Tốc độ quay (rpm) và mô-men xoắn (Nm) mô tả chuyển động quay và tải khi gia công.',
  },
  table: {
    name: 'Bàn gia công',
    function: 'Bàn đỡ và định vị phôi so với dao cắt.',
    input: 'AI4I 2020 không có thông số đo riêng cho bàn gia công.',
  },
  door: {
    name: 'Cửa bảo vệ',
    function: 'Cửa che khu vực gia công và giúp chắn phoi khi máy hoạt động.',
    input: 'Trạng thái cửa không nằm trong dữ liệu đầu vào AI4I 2020.',
  },
} as const;

type CncPart = keyof typeof cncParts;
const cncPartKeys = Object.keys(cncParts) as CncPart[];

interface Machine3DViewerProps {
  status?: 'illustrative' | 'normal' | 'failure';
  interactive?: boolean;
  className?: string;
  height?: string;
  caption?: string;
  heroPoster?: string;
  autoRotate?: boolean;
  exploreParts?: boolean;
}

export const Machine3DViewer: React.FC<Machine3DViewerProps> = ({
  status = 'illustrative',
  interactive = true,
  className = '',
  height = 'h-64 sm:h-72 lg:h-80',
  heroPoster,
  autoRotate = false,
  exploreParts = false,
  caption = 'Máy phay CNC 3D minh họa quy trình gia công trong bộ dữ liệu AI4I 2020',
}) => {
  const [exploded, setExploded] = useState(false);
  const explodedRef = useRef(false);
  const [autoRotationPaused, setAutoRotationPaused] = useState(false);
  const rotationPausedRef = useRef(false);

  const partsId = useId();
  const [selectedPart, setSelectedPart] = useState<CncPart | null>(null);
  const selectedPartRef = useRef<CncPart | null>(null);

  const selectPart = (part: CncPart | null) => {
    selectedPartRef.current = part;
    setSelectedPart(part);
  };

  const toggleAutoRotation = () => {
    rotationPausedRef.current = !rotationPausedRef.current;
    setAutoRotationPaused(rotationPausedRef.current);
  };
  const setAssemblyTarget = useRef<((exploded: boolean) => void) | null>(null);

  const toggleAssembly = () => {
    explodedRef.current = !explodedRef.current;
    setExploded(explodedRef.current);
    if (!explodedRef.current) selectPart(null);
    setAssemblyTarget.current?.(explodedRef.current);
  };

  const orbitRef = useRef<((angle: number) => void) | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGLAvailable, setWebGLAvailable] = useState<boolean>(true);
  const [use2DFallback, setUse2DFallback] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  
  // Track reset view trigger
  const resetCameraRef = useRef<(() => void) | null>(null);

  const isFailure = status === 'failure';
  const isNormal = status === 'normal';
  const isIllustrative = status === 'illustrative';

  // React to prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (use2DFallback || !webGLAvailable) return;
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 340;
    let heightPx = container.clientHeight || 280;

    // Scene & Camera setup (3/4 isometric perspective)
    const scene = new THREE.Scene();
    
    // Initial 3/4 angle
    const initialCamPos = new THREE.Vector3(4.5, 3.2, 5.0);
    const cameraTarget = new THREE.Vector3(0, 1.4, 0);

    const camera = new THREE.PerspectiveCamera(40, width / heightPx, 0.1, 100);
    camera.position.copy(initialCamPos);
    camera.lookAt(cameraTarget);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebGLAvailable(false);
      return;
    }
    const showStillFallback = () => setWebGLAvailable(false);
    renderer.debug.onShaderError = showStillFallback;
    renderer.domElement.addEventListener('webglcontextlost', showStillFallback);
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const machineGroup = new THREE.Group();
    scene.add(machineGroup);

    // ================= MATERIALS =================
    // Light gray industrial enclosure body (vỏ máy kín màu xám sáng)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Light silver-gray
      metalness: 0.25,
      roughness: 0.35,
    });
    
    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.4,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      metalness: 0.45,
      roughness: 0.28,
    });

    const ironTableMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.5,
      roughness: 0.6,
    });

    // Light blue-tinted transparent safety glass window
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.24,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      ior: 1.5,
    });

    // Soft ground shadow contact disc
    const shadowGeo = new THREE.PlaneGeometry(5.2, 4.0);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: heroPoster ? 0.06 : 0.55,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.01;
    scene.add(shadowMesh);

    // ================= CNC MACHINE ARCHITECTURE =================
    // 1. Lower Machine Base / Bed Stand
    const baseGeo = new THREE.BoxGeometry(3.2, 0.7, 2.4);
    const baseMesh = new THREE.Mesh(baseGeo, darkAccentMat);
    baseMesh.position.set(0, 0.35, 0);
    machineGroup.add(baseMesh);

    // Base Ventilation Louvers (rãnh tản nhiệt đế máy)
    for (let i = 0; i < 4; i++) {
      const ventGeo = new THREE.BoxGeometry(1.6, 0.04, 0.05);
      const ventMesh = new THREE.Mesh(ventGeo, bodyMat);
      ventMesh.position.set(0, 0.2 + i * 0.1, 1.21);
      machineGroup.add(ventMesh);
    }

    // 2. Main Enclosed Cabinet (Thân máy kín)
    // Left & Right Panels
    const sideLeftGeo = new THREE.BoxGeometry(0.3, 2.0, 2.4);
    const sideLeftMesh = new THREE.Mesh(sideLeftGeo, bodyMat);
    sideLeftMesh.position.set(-1.45, 1.7, 0);
    machineGroup.add(sideLeftMesh);

    const sideRightGeo = new THREE.BoxGeometry(0.3, 2.0, 2.4);
    const sideRightMesh = new THREE.Mesh(sideRightGeo, bodyMat);
    sideRightMesh.position.set(1.45, 1.7, 0);
    machineGroup.add(sideRightMesh);

    // Back Panel
    const backGeo = new THREE.BoxGeometry(3.2, 2.0, 0.3);
    const backMesh = new THREE.Mesh(backGeo, bodyMat);
    backMesh.position.set(0, 1.7, -1.05);
    machineGroup.add(backMesh);

    // Top Roof
    const roofGeo = new THREE.BoxGeometry(3.2, 0.25, 2.4);
    const roofMesh = new THREE.Mesh(roofGeo, darkAccentMat);
    roofMesh.position.set(0, 2.72, 0);
    machineGroup.add(roofMesh);

    // 3. Front Window Frame & Glass Door
    const windowFrameGeo = new THREE.BoxGeometry(2.3, 1.7, 0.08);
    const windowFrame = new THREE.Mesh(windowFrameGeo, darkAccentMat);
    windowFrame.position.set(0, 1.7, 1.16);
    machineGroup.add(windowFrame);

    const glassGeo = new THREE.BoxGeometry(2.0, 1.45, 0.04);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(0, 1.7, 1.18);
    machineGroup.add(glassMesh);

    // Door Handle (tay nắm thanh kim loại dọc)
    const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 12);
    const handleMesh = new THREE.Mesh(handleGeo, chromeMat);
    handleMesh.position.set(0.95, 1.7, 1.23);
    machineGroup.add(handleMesh);

    // 4. Interior: Worktable & Spindle Column
    // Cast iron T-slot table (bàn gá phôi)
    const tableGeo = new THREE.BoxGeometry(1.8, 0.25, 1.3);
    const tableMesh = new THREE.Mesh(tableGeo, ironTableMat);
    tableMesh.position.set(0, 0.82, 0);
    machineGroup.add(tableMesh);

    // Workpiece metal stock on table
    const workpieceGeo = new THREE.BoxGeometry(0.65, 0.3, 0.65);
    const workpieceMesh = new THREE.Mesh(workpieceGeo, chromeMat);
    workpieceMesh.position.set(0, 1.1, 0);
    machineGroup.add(workpieceMesh);

    // Vertical Spindle Ram & Tool Chuck (trục chính và đầu gá dao)
    const spindleColGeo = new THREE.BoxGeometry(0.5, 0.9, 0.5);
    const spindleColMesh = new THREE.Mesh(spindleColGeo, darkAccentMat);
    spindleColMesh.position.set(0, 2.1, 0);
    machineGroup.add(spindleColMesh);

    const spindleRotGroup = new THREE.Group();
    spindleRotGroup.position.set(0, 1.65, 0);

    const chuckGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.3, 24);
    const chuckMesh = new THREE.Mesh(chuckGeo, chromeMat);
    spindleRotGroup.add(chuckMesh);

    const toolGeo = new THREE.ConeGeometry(0.045, 0.35, 16);
    toolGeo.rotateX(Math.PI);
    const toolMesh = new THREE.Mesh(toolGeo, chromeMat);
    toolMesh.position.y = -0.28;
    spindleRotGroup.add(toolMesh);

    machineGroup.add(spindleRotGroup);

    // 5. Operator Control Panel Pendant (Bảng điều khiển CNC bên hông)
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12);
    armGeo.rotateZ(Math.PI / 2);
    const armMesh = new THREE.Mesh(armGeo, darkAccentMat);
    armMesh.position.set(1.7, 2.0, 0.7);
    machineGroup.add(armMesh);

    const pendantGeo = new THREE.BoxGeometry(0.4, 0.75, 0.5);
    const pendantMesh = new THREE.Mesh(pendantGeo, darkAccentMat);
    pendantMesh.position.set(1.9, 1.95, 0.7);
    pendantMesh.rotation.y = -0.35; // angled toward operator front
    machineGroup.add(pendantMesh);

    // Screen face
    const screenGeo = new THREE.PlaneGeometry(0.32, 0.28);
    screenGeo.rotateY(Math.PI / 2);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 }); // Cyan telemetry display
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(-0.21, 0.16, 0);
    pendantMesh.add(screenMesh);

    // 6. Top Signal Tower Light (Đèn tháp 3 tầng trên nóc máy)
    const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12);
    const poleMesh = new THREE.Mesh(poleGeo, chromeMat);
    poleMesh.position.set(-1.1, 2.95, -0.6);
    machineGroup.add(poleMesh);

    // Red lens (top)
    const redLightColor = isFailure ? 0xef4444 : 0x450a0a;
    const redLightMat = new THREE.MeshStandardMaterial({
      color: redLightColor,
      emissive: isFailure ? 0xef4444 : 0x000000,
      emissiveIntensity: isFailure ? 2.5 : 0.0,
      roughness: 0.2,
    });
    const redLensGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16);
    const redLensMesh = new THREE.Mesh(redLensGeo, redLightMat);
    redLensMesh.position.set(-1.1, 3.4, -0.6);
    machineGroup.add(redLensMesh);

    // Amber lens (middle)
    const amberLensGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16);
    const amberLensMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0x000000,
      roughness: 0.2,
    });
    const amberLensMesh = new THREE.Mesh(amberLensGeo, amberLensMat);
    amberLensMesh.position.set(-1.1, 3.26, -0.6);
    machineGroup.add(amberLensMesh);

    // Green lens (bottom)
    const greenActive = isNormal || isIllustrative;
    const greenLightColor = greenActive ? 0x10b981 : 0x064e3b;
    const greenLightMat = new THREE.MeshStandardMaterial({
      color: greenLightColor,
      emissive: greenActive ? 0x10b981 : 0x000000,
      emissiveIntensity: greenActive ? 2.0 : 0.0,
      roughness: 0.2,
    });
    const greenLensGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16);
    const greenLensMesh = new THREE.Mesh(greenLensGeo, greenLightMat);
    greenLensMesh.position.set(-1.1, 3.12, -0.6);
    machineGroup.add(greenLensMesh);

    // Cap on top of tower
    const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
    const capMesh = new THREE.Mesh(capGeo, darkAccentMat);
    capMesh.position.set(-1.1, 3.48, -0.6);
    machineGroup.add(capMesh);

    // Dedicated PointLight from active indicator lens
    const towerPointLight = new THREE.PointLight(
      isFailure ? 0xef4444 : 0x10b981, 
      isFailure ? 1.8 : 0.9, 
      4.0
    );
    towerPointLight.position.set(-1.1, isFailure ? 3.4 : 3.12, -0.6);
    scene.add(towerPointLight);

    // ================= LIGHTING =================
    // Ambient light
    const ambLight = new THREE.HemisphereLight(0xf1f5ff, 0x9eabbc, 1.35);
    scene.add(ambLight);

    // Primary front-right key light (chiếu từ trước để làm nổi bật vỏ máy)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(5.0, 6.0, 6.0);
    scene.add(keyLight);

    // Soft fill light from left
    const fillLight = new THREE.DirectionalLight(0xd8eeff, 1.05);
    fillLight.position.set(-5.0, 3.0, 3.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 1.25);
    rimLight.position.set(1, 5, -5);
    scene.add(rimLight);

    // Interior cabinet spot light
    const interiorLight = new THREE.PointLight(0xffffff, 1.2, 3.0);
    interiorLight.position.set(0, 2.5, 0.5);
    scene.add(interiorLight);

    // ================= INTERACTIVE ORBIT & DRAG =================
    let dragging = false;
    let prev = { x: 0, y: 0 };
    const radius = camera.position.length();
    let theta = Math.atan2(camera.position.x, camera.position.z);
    let phi = Math.acos(camera.position.y / radius);

    const updateCamera = () => {
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );
      camera.lookAt(cameraTarget);
    };

    orbitRef.current = angle => {
      theta += angle;
      updateCamera();
    };

    const partMeshes: Record<CncPart, THREE.Mesh> = {
      tool: toolMesh,
      spindle: spindleColMesh,
      table: tableMesh,
      door: windowFrame,
    };
    const pickable = new Map<THREE.Object3D, CncPart>([
      [toolMesh, 'tool'], [spindleColMesh, 'spindle'], [chuckMesh, 'spindle'],
      [tableMesh, 'table'], [workpieceMesh, 'table'],
      [windowFrame, 'door'], [glassMesh, 'door'], [handleMesh, 'door'],
    ]);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const outline = exploreParts ? new THREE.BoxHelper(toolMesh, 0x067660) : null;
    if (outline) {
      outline.visible = false;
      scene.add(outline);
    }
    let outlinedPart: CncPart | null = null;
    const pointerStart = new THREE.Vector2();
    let moved = false;

    let activePointer: number | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || activePointer !== null) return;
      activePointer = e.pointerId;
      pointerStart.set(e.clientX, e.clientY);
      moved = false;
      dragging = true;
      prev = { x: e.clientX, y: e.clientY };
      container.setPointerCapture(e.pointerId);
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      dragging = false;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointer || moved || !exploreParts || !explodedRef.current) return;
      if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) >= 5) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) return;
      pointer.set((e.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (e.clientY - bounds.top) / bounds.height * 2);
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObject(machineGroup, true);
      const part = hit && pickable.get(hit.object);
      if (part) selectPart(part);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      moved ||= Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) >= 5;
      if (exploreParts && explodedRef.current && !moved) return;
      theta -= (e.clientX - prev.x) * 0.012;
      phi = THREE.MathUtils.clamp(phi - (e.clientY - prev.y) * 0.007, 0.2, Math.PI / 2 - 0.05);
      updateCamera();
      prev = { x: e.clientX, y: e.clientY };
    };

    if (interactive) {
      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('lostpointercapture', onPointerEnd);
      container.addEventListener('pointermove', onPointerMove);
      if (exploreParts) container.addEventListener('pointerup', onPointerUp);
    }

    // Reset Camera Function
    resetCameraRef.current = () => {
      camera.position.copy(initialCamPos);
      camera.lookAt(cameraTarget);
      theta = Math.atan2(initialCamPos.x, initialCamPos.z);
      phi = Math.acos(initialCamPos.y / radius);
      machineGroup.rotation.y = 0;
    };

    const assemblies = [
      { parts: [windowFrame, glassMesh, handleMesh], offset: [0, 0.12, 1.7] },
      { parts: [sideLeftMesh], offset: [-1.45, 0.04, 0] },
      { parts: [sideRightMesh, armMesh, pendantMesh], offset: [1.45, 0.04, 0] },
      { parts: [backMesh], offset: [0, 0, -1.25] },
      { parts: [roofMesh, poleMesh, redLensMesh, amberLensMesh, greenLensMesh, capMesh, towerPointLight], offset: [0, 1.1, 0] },
      { parts: [spindleColMesh, spindleRotGroup], offset: [0, 0.4, 0.55] },
      { parts: [tableMesh, workpieceMesh], offset: [0, 0, 0.83] },
    ].flatMap(({ parts, offset }) => parts.map(part => ({
      part,
      assembled: part.position.clone(),
      offset: new THREE.Vector3(...offset),
    })));
    const assembly = { progress: Number(explodedRef.current) };
    let assemblyTween: ReturnType<typeof animateTween> | undefined;

    setAssemblyTarget.current = exploded => {
      assemblyTween?.cancel();
      const target = Number(exploded);
      const distance = Math.abs(target - assembly.progress);
      if (prefersReducedMotion || distance === 0) {
        assembly.progress = target;
        return;
      }

      assemblyTween = animateTween(assembly, {
        progress: target,
        duration: 850 * distance,
        ease: 'inOutQuad',
      });
    };
    let appliedProgress = -1;

    // ================= ANIMATION LOOP =================
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const assemblyProgress = assembly.progress;
      if (assemblyProgress !== appliedProgress) {
        for (const { part, assembled, offset } of assemblies) {
          part.position.copy(assembled).addScaledVector(offset, assemblyProgress);
        }
        camera.zoom = 1 - assemblyProgress * (camera.aspect < 1.2 ? 0.32 : 0.24);
        camera.updateProjectionMatrix();
        appliedProgress = assemblyProgress;
      }

      if (!prefersReducedMotion && assemblyProgress === 0) {
        // Continuous spindle rotation
        spindleRotGroup.rotation.y += delta * 12.0;

        const rotateOnLanding = autoRotate && !rotationPausedRef.current;
        if (!dragging && !explodedRef.current && (rotateOnLanding || (!heroPoster && !autoRotate))) {
          machineGroup.rotation.y += Math.min(delta, 0.05) * (autoRotate ? Math.PI / 10 : 0.12);
        }
      }

      if (outline) {
        const part = selectedPartRef.current;
        outline.visible = part !== null;
        if (part && part !== outlinedPart) outline.setFromObject(partMeshes[part]);
        else if (part) outline.update();
        outlinedPart = part;
      }
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 340;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('lostpointercapture', onPointerEnd);
        container.removeEventListener('pointermove', onPointerMove);
        if (exploreParts) container.removeEventListener('pointerup', onPointerUp);
      }
      orbitRef.current = null;
      setAssemblyTarget.current = null;
      assemblyTween?.cancel();
      renderer.domElement.removeEventListener('webglcontextlost', showStillFallback);
      renderer.domElement.remove();
      outline?.dispose();
      renderer.dispose();
      // Dispose geometries
      baseGeo.dispose();
      sideLeftGeo.dispose();
      sideRightGeo.dispose();
      backGeo.dispose();
      roofGeo.dispose();
      windowFrameGeo.dispose();
      glassGeo.dispose();
      tableGeo.dispose();
      workpieceGeo.dispose();
      spindleColGeo.dispose();
      chuckGeo.dispose();
      toolGeo.dispose();
      pendantGeo.dispose();
      redLensGeo.dispose();
      amberLensGeo.dispose();
      greenLensGeo.dispose();
    };
  }, [status, interactive, use2DFallback, webGLAvailable, prefersReducedMotion, heroPoster, autoRotate, exploreParts]);

  return (
    <div className={`relative rounded-2xl border border-slate-700/60 bg-slate-900 shadow-xl overflow-hidden flex flex-col p-3 select-none text-slate-100 ${heroPoster ? 'cnc-landing-viewer' : ''} ${className}`}>
      
      {/* 2D Fallback view */}
      {heroPoster && (!webGLAvailable || use2DFallback) ? (
        <img src={heroPoster} alt="Máy phay CNC" width={1536} height={1024} />
      ) : (!webGLAvailable || use2DFallback) ? (
        <div className={`w-full ${height} flex flex-col items-center justify-center p-4 text-center bg-slate-900`}>
          <div className="relative mb-3">
            <svg viewBox="0 0 240 180" className="w-56 h-44 drop-shadow-md">
              {/* CNC Machine Base Bed */}
              <rect x="30" y="125" width="180" height="35" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              {/* CNC Light Gray Enclosure */}
              <rect x="40" y="40" width="145" height="85" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
              {/* Front Dark Window Frame */}
              <rect x="58" y="50" width="105" height="65" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
              {/* Light-blue tinted safety glass window */}
              <rect x="62" y="54" width="97" height="57" rx="2" fill="#7dd3fc" fillOpacity="0.4" />
              {/* Spindle Chuck and Tool inside */}
              <rect x="104" y="62" width="14" height="18" fill="#a1a1aa" />
              <polygon points="111,92 107,80 115,80" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              {/* Fixture worktable */}
              <rect x="76" y="96" width="70" height="12" fill="#475569" rx="1" />
              {/* Side Pendant Control Panel */}
              <rect x="190" y="60" width="22" height="40" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
              <rect x="193" y="64" width="16" height="14" rx="1" fill="#0284c7" />
              {/* Top Signal Tower Light */}
              <line x1="56" y1="40" x2="56" y2="18" stroke="#94a3b8" strokeWidth="3" />
              {/* Red Tower Lens */}
              <circle cx="56" cy="18" r="6" fill={isFailure ? '#ef4444' : '#450a0a'} stroke="#64748b" strokeWidth="1" />
              {/* Amber Tower Lens */}
              <circle cx="56" cy="27" r="5" fill="#78350f" />
              {/* Green Tower Lens */}
              <circle cx="56" cy="35" r="5" fill={isNormal || isIllustrative ? '#10b981' : '#064e3b'} />
            </svg>

            {/* Status indicator tag */}
            <div className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shadow ${
              isFailure 
                ? 'bg-red-950 text-red-200 border-red-500' 
                : isNormal
                  ? 'bg-emerald-950 text-emerald-200 border-emerald-500'
                  : 'bg-slate-800 text-slate-200 border-slate-600'
            }`}>
              {isFailure ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isFailure ? 'Cảnh báo hỏng' : isNormal ? 'Bình thường' : 'Minh họa'}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Chế độ hiển thị 2D kỹ thuật</p>
        </div>
      ) : (
        /* 3D WebGL Canvas */
        <div ref={mountRef} className={`w-full ${height} touch-pan-y cursor-grab active:cursor-grabbing relative flex items-center justify-center`} />
      )}

      {/* Floating Toolbar & Status Badge */}
      <div className="w-full flex items-center justify-between pt-2.5 border-t border-slate-800/80 px-1">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            isFailure 
              ? 'bg-red-500 ring-2 ring-red-400/40' 
              : isNormal 
                ? 'bg-emerald-400 ring-2 ring-emerald-400/40' 
                : 'bg-teal-400'
          }`} />
          <span className="text-xs font-medium text-slate-200">
            {isFailure 
              ? 'Đèn tín hiệu nóc máy: ĐỎ (Cảnh báo hỏng)' 
              : isNormal 
                ? 'Đèn tín hiệu nóc máy: XANH (Bình thường)' 
                : 'Đèn tín hiệu nóc máy: Minh họa'}
          </span>
        </div>

        {/* View Controls */}
        <div className={`flex items-center gap-1.5 ${heroPoster ? "flex-wrap justify-center" : ""}`}>
          {heroPoster && !use2DFallback && webGLAvailable && (
            <>
              <button type="button" aria-label="Xoay trái" onClick={() => orbitRef.current?.(-Math.PI / 6)}>
                <RotateCcw size={15} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Xoay phải" onClick={() => orbitRef.current?.(Math.PI / 6)}>
                <RotateCw size={15} aria-hidden="true" />
              </button>
            </>
          )}
          {autoRotate && webGLAvailable && !use2DFallback && !prefersReducedMotion && (
            <button type="button" onClick={toggleAutoRotation}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700">
              {autoRotationPaused ? 'Bật tự xoay' : 'Tạm dừng xoay'}
            </button>
          )}
          {!heroPoster && resetCameraRef.current && !use2DFallback && webGLAvailable && (
            <button
              onClick={() => resetCameraRef.current?.()}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
              title="Đặt lại góc nhìn chéo 3/4"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Đặt lại góc nhìn</span>
            </button>
          )}

          {!use2DFallback && webGLAvailable && interactive && (
            <button
              type="button"
              onClick={toggleAssembly}
              aria-pressed={exploded}
              aria-controls={exploreParts ? partsId : undefined}
              className="text-[11px] text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              {exploded ? 'Lắp lại' : 'Tháo máy'}
            </button>
          )}
          {webGLAvailable && (
            <button
              onClick={() => setUse2DFallback(!use2DFallback)}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
              title="Chuyển đổi giữa chế độ 3D và 2D"
            >
              <Eye className="w-3 h-3 text-slate-400" />
              <span>{use2DFallback ? 'Mở 3D' : 'Xem 2D'}</span>
            </button>
          )}
        </div>
      </div>

      {exploreParts && (
        <section id={partsId} hidden={!exploded} className="cnc-part-inspector" aria-label="Các bộ phận CNC">
          <h2>Khám phá bộ phận CNC</h2>
          <div role="group" aria-label="Chọn bộ phận" className="cnc-part-options">
            {cncPartKeys.map(part => (
              <button key={part} type="button" aria-pressed={selectedPart === part} onClick={() => selectPart(part)}>
                {cncParts[part].name}
              </button>
            ))}
          </div>
          <div className="cnc-part-detail" aria-live="polite">
            {selectedPart ? (
              <>
                <strong>{cncParts[selectedPart].name}</strong>
                <p>{cncParts[selectedPart].function} {cncParts[selectedPart].input}</p>
              </>
            ) : <p>Chọn trong danh sách hoặc bấm trực tiếp vào mô hình 3D.</p>}
          </div>
        </section>
      )}

      {/* Mandatory explicit caption */}
      {caption && (!heroPoster || (webGLAvailable && !use2DFallback)) && (
        <p className="text-[11px] text-slate-400 text-center mt-1.5 italic">
          {heroPoster ? caption : `* ${caption}`}
        </p>
      )}
    </div>
  );
};
