import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Agent, Member, Task, Team } from '@/types';

type OfficeTeam = Team & {
	members: Member[];
	tasks: Task[];
	description?: string;
};

type AgentWithMember = Agent & {
	member?: Pick<Member, 'id' | 'teamId'>;
};

interface AgentOfficeSceneProps {
	teams: OfficeTeam[];
	agents: AgentWithMember[];
	selectedMemberId?: string | null;
	onSelect?: (selection: AgentOfficeSelection) => void;
}

const TEAM_COLORS = [0x2563eb, 0x059669, 0xd97706, 0x9333ea, 0x0891b2, 0xbe123c];

export type AgentOfficeSelection = {
	teamId: string;
	teamName: string;
	memberId?: string;
	memberName?: string;
	memberRole?: string;
	memberType?: Member['type'];
	agentId?: string;
	agentName?: string;
	agentModel?: string;
	agentStatus?: Agent['status'];
};

function makeTextSprite(text: string, color = '#f8fafc') {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 128;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.font = '600 34px Arial';
	ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
	ctx.fillRect(0, 18, canvas.width, 72);
	ctx.fillStyle = color;
	ctx.textBaseline = 'middle';
	ctx.fillText(text.slice(0, 24), 24, 54, 464);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(4.2, 1.05, 1);
	return sprite;
}

function disposeObject(object: THREE.Object3D) {
	object.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (mesh.geometry) mesh.geometry.dispose();
		const material = mesh.material;
		if (Array.isArray(material)) material.forEach((item) => item.dispose());
		else if (material) material.dispose();
	});
}

export default function AgentOfficeScene({ teams, agents, selectedMemberId, onSelect }: AgentOfficeSceneProps) {
	const mountRef = useRef<HTMLDivElement | null>(null);
	const zoomInRef = useRef<HTMLButtonElement | null>(null);
	const zoomOutRef = useRef<HTMLButtonElement | null>(null);
	const zoomHomeRef = useRef<HTMLButtonElement | null>(null);
	const viewSpanRef = useRef<number | null>(null);
	const floorPositionRef = useRef(new THREE.Vector3());

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return undefined;

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0b1020);

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		mount.appendChild(renderer.domElement);

		const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
		camera.position.set(13, 12, 13);
		camera.lookAt(0, 0, 0);
		const baseSpan = teams.length <= 2 ? 7 : 10;
		const viewSpan = { current: viewSpanRef.current ?? baseSpan };

		const ambient = new THREE.AmbientLight(0xffffff, 0.72);
		scene.add(ambient);
		const key = new THREE.DirectionalLight(0xffffff, 1.25);
		key.position.set(7, 11, 5);
		key.castShadow = true;
		scene.add(key);

		const group = new THREE.Group();
		group.position.copy(floorPositionRef.current);
		scene.add(group);
		const clickTargets: THREE.Object3D[] = [];

		const floor = new THREE.Mesh(
			new THREE.BoxGeometry(24, 0.22, 16),
			new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }),
		);
		floor.position.y = -0.15;
		floor.receiveShadow = true;
		group.add(floor);

		const grid = new THREE.GridHelper(24, 24, 0x334155, 0x1e293b);
		grid.position.y = 0.01;
		group.add(grid);

		const agentsByMember = new Map<string, AgentWithMember>();
		agents.forEach((agent) => agentsByMember.set(agent.memberId, agent));

		const cols = Math.max(1, Math.ceil(Math.sqrt(teams.length)));
		const bayWidth = 9.4;
		const bayDepth = 6.2;
		const startX = -((Math.min(cols, teams.length) - 1) * bayWidth) / 2;
		const rows = Math.ceil(teams.length / cols);
		const startZ = -((rows - 1) * bayDepth) / 2;

		teams.forEach((team, index) => {
			const col = index % cols;
			const row = Math.floor(index / cols);
			const x = startX + col * bayWidth;
			const z = startZ + row * bayDepth;
			const color = TEAM_COLORS[index % TEAM_COLORS.length];

			const bay = new THREE.Group();
			bay.position.set(x, 0, z);
			group.add(bay);

			const platform = new THREE.Mesh(
				new THREE.BoxGeometry(8.2, 0.28, 5.2),
				new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 }),
			);
			platform.position.y = 0.02;
			platform.castShadow = true;
			platform.receiveShadow = true;
			platform.userData.selection = { teamId: team.id, teamName: team.name } satisfies AgentOfficeSelection;
			bay.add(platform);
			clickTargets.push(platform);

			const wallBack = new THREE.Mesh(
				new THREE.BoxGeometry(8.2, 1.1, 0.18),
				new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
			);
			wallBack.position.set(0, 0.65, -2.55);
			wallBack.castShadow = true;
			bay.add(wallBack);

			const wallSide = new THREE.Mesh(
				new THREE.BoxGeometry(0.18, 1.1, 5.2),
				new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.8 }),
			);
			wallSide.position.set(-4.1, 0.65, 0);
			wallSide.castShadow = true;
			bay.add(wallSide);

			const label = makeTextSprite(team.name);
			if (label) {
				label.position.set(0, 1.65, -2.75);
				bay.add(label);
			}

			const members = team.members || [];
			const deskCols = Math.max(1, Math.ceil(Math.sqrt(Math.max(members.length, 1))));
			members.forEach((member, memberIndex) => {
				const deskCol = memberIndex % deskCols;
				const deskRow = Math.floor(memberIndex / deskCols);
				const deskX = -2.8 + deskCol * 1.9;
				const deskZ = -1.35 + deskRow * 1.65;
				const agent = agentsByMember.get(member.id);
				const selection: AgentOfficeSelection = {
					teamId: team.id,
					teamName: team.name,
					memberId: member.id,
					memberName: member.name,
					memberRole: member.role,
					memberType: member.type,
					agentId: agent?.id,
					agentName: agent?.name,
					agentModel: agent?.model,
					agentStatus: agent?.status,
				};

				const desk = new THREE.Group();
				desk.position.set(deskX, 0.26, deskZ);
				bay.add(desk);

				const desktop = new THREE.Mesh(
					new THREE.BoxGeometry(1.25, 0.22, 0.82),
					new THREE.MeshStandardMaterial({
						color: selectedMemberId === member.id ? 0xf8fafc : member.type === 'ai' ? 0x334155 : 0x475569,
						roughness: 0.65,
						emissive: selectedMemberId === member.id ? 0x2563eb : 0x000000,
						emissiveIntensity: selectedMemberId === member.id ? 0.25 : 0,
					}),
				);
				desktop.position.y = 0.48;
				desktop.castShadow = true;
				desktop.userData.selection = selection;
				desk.add(desktop);
				clickTargets.push(desktop);

				const monitor = new THREE.Mesh(
					new THREE.BoxGeometry(0.58, 0.42, 0.08),
					new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.4, emissive: agent?.status === 'working' ? 0x16a34a : 0x0f172a, emissiveIntensity: agent?.status === 'working' ? 0.45 : 0.12 }),
				);
				monitor.position.set(0, 0.86, -0.27);
				monitor.userData.selection = selection;
				desk.add(monitor);
				clickTargets.push(monitor);

				const chair = new THREE.Mesh(
					new THREE.CylinderGeometry(0.27, 0.31, 0.24, 18),
					new THREE.MeshStandardMaterial({ color: member.type === 'ai' ? 0x7c3aed : 0x2563eb, roughness: 0.7 }),
				);
				chair.position.set(0, 0.25, 0.55);
				chair.castShadow = true;
				chair.userData.selection = selection;
				desk.add(chair);
				clickTargets.push(chair);

				const status = new THREE.Mesh(
					new THREE.SphereGeometry(0.12, 16, 16),
					new THREE.MeshStandardMaterial({
						color: agent?.status === 'error' ? 0xef4444 : agent?.status === 'working' ? 0x22c55e : 0x94a3b8,
						emissive: agent?.status === 'error' ? 0x991b1b : agent?.status === 'working' ? 0x166534 : 0x334155,
						emissiveIntensity: 0.6,
					}),
				);
				status.position.set(0.56, 0.74, -0.34);
				status.userData.selection = selection;
				desk.add(status);
				clickTargets.push(status);
			});
		});

		let frame = 0;
		const resize = () => {
			const width = mount.clientWidth || 900;
			const height = mount.clientHeight || 560;
			renderer.setSize(width, height, false);
			const aspect = width / height;
			const span = viewSpan.current;
			camera.left = -span * aspect;
			camera.right = span * aspect;
			camera.top = span;
			camera.bottom = -span;
			camera.updateProjectionMatrix();
		};
		const setSpan = (next: number) => {
			viewSpan.current = Math.max(3.6, Math.min(16, next));
			viewSpanRef.current = viewSpan.current;
			resize();
		};
		const zoomIn = () => setSpan(viewSpan.current * 0.78);
		const zoomOut = () => setSpan(viewSpan.current * 1.28);
		const zoomHome = () => setSpan(baseSpan);
		resize();
		window.addEventListener('resize', resize);
		const zoomInButton = zoomInRef.current;
		const zoomOutButton = zoomOutRef.current;
		const zoomHomeButton = zoomHomeRef.current;
		zoomInButton?.addEventListener('click', zoomIn);
		zoomOutButton?.addEventListener('click', zoomOut);
		zoomHomeButton?.addEventListener('click', zoomHome);

		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		const drag = {
			active: false,
			lastX: 0,
			lastY: 0,
			moved: false,
		};
		const screenRight = new THREE.Vector3(1, 0, -1).normalize();
		const screenUp = new THREE.Vector3(-1, 0, -1).normalize();
		const updatePointer = (event: PointerEvent) => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);
			return raycaster.intersectObjects(clickTargets, false);
		};
		const handlePointerMove = (event: PointerEvent) => {
			if (drag.active) {
				const dx = event.clientX - drag.lastX;
				const dy = event.clientY - drag.lastY;
				if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
				const panScale = viewSpan.current / 420;
				group.position.addScaledVector(screenRight, dx * panScale);
				group.position.addScaledVector(screenUp, -dy * panScale);
				floorPositionRef.current.copy(group.position);
				drag.lastX = event.clientX;
				drag.lastY = event.clientY;
				mount.style.cursor = 'grabbing';
				return;
			}
			mount.style.cursor = updatePointer(event).length ? 'pointer' : 'default';
		};
		const handlePointerDown = (event: PointerEvent) => {
			drag.active = true;
			drag.lastX = event.clientX;
			drag.lastY = event.clientY;
			drag.moved = false;
			renderer.domElement.setPointerCapture(event.pointerId);
			mount.style.cursor = 'grabbing';
		};
		const handlePointerUp = (event: PointerEvent) => {
			drag.active = false;
			if (renderer.domElement.hasPointerCapture(event.pointerId)) {
				renderer.domElement.releasePointerCapture(event.pointerId);
			}
			mount.style.cursor = 'default';
		};
		const handleClick = (event: PointerEvent) => {
			if (drag.moved) return;
			const hit = updatePointer(event)[0]?.object.userData.selection as AgentOfficeSelection | undefined;
			if (hit) onSelect?.(hit);
		};
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			setSpan(viewSpan.current * Math.exp(event.deltaY * 0.0018));
		};
		renderer.domElement.addEventListener('pointermove', handlePointerMove);
		renderer.domElement.addEventListener('pointerdown', handlePointerDown);
		renderer.domElement.addEventListener('pointerup', handlePointerUp);
		renderer.domElement.addEventListener('pointerleave', handlePointerUp);
		renderer.domElement.addEventListener('click', handleClick);
		renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

		const animate = () => {
			frame = requestAnimationFrame(animate);
			group.rotation.y = Math.sin(Date.now() * 0.00025) * 0.025;
			renderer.render(scene, camera);
		};
		animate();

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', resize);
			zoomInButton?.removeEventListener('click', zoomIn);
			zoomOutButton?.removeEventListener('click', zoomOut);
			zoomHomeButton?.removeEventListener('click', zoomHome);
			renderer.domElement.removeEventListener('pointermove', handlePointerMove);
			renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
			renderer.domElement.removeEventListener('pointerup', handlePointerUp);
			renderer.domElement.removeEventListener('pointerleave', handlePointerUp);
			renderer.domElement.removeEventListener('click', handleClick);
			renderer.domElement.removeEventListener('wheel', handleWheel);
			disposeObject(scene);
			renderer.dispose();
			renderer.domElement.remove();
		};
	}, [agents, onSelect, selectedMemberId, teams]);

	return (
		<div className="relative">
			<div ref={mountRef} className="h-[620px] min-h-[500px] w-full overflow-hidden rounded-lg bg-slate-950" />
			<div className="absolute left-4 top-4 flex overflow-hidden rounded-md border border-white/10 bg-slate-950/80 shadow-lg backdrop-blur">
				<button ref={zoomInRef} type="button" className="px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" title="Zoom in">+</button>
				<button ref={zoomOutRef} type="button" className="border-x border-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10" title="Zoom out">-</button>
				<button ref={zoomHomeRef} type="button" className="px-3 py-2 text-xs font-semibold text-white hover:bg-white/10" title="Reset zoom">HOME</button>
			</div>
			<div className="absolute bottom-4 left-4 rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 backdrop-blur">
				Drag to move floor. Scroll to zoom. Click any desk or bay.
			</div>
		</div>
	);
}
