const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Parámetros del mundo
const TILE_SIZE = 32;
const WORLD_WIDTH = 500;
const WORLD_HEIGHT = 500;
const world = [];
const objects = [];

// Definición de biomas
const BIOMES = {
    "dirt": { color: "#78451A" },
    "grass1": { color: "#4A8A22" },
    "grass2": { color: "#5DAA2A" },
    "forest": { color: "#184A22" }
};

noise.seed(Math.random());

function generateWorld() {
    const scale = 50;  // A mayor escala, las regiones son más grandes.
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        world[y] = [];
        objects[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            let n = noise.perlin2(x / scale, y / scale);
            let biome;
            if (n < -0.3) {
                biome = "dirt";
            } else if (n < 0) {
                biome = "grass1";
            } else if (n < 0.3) {
                biome = "grass2";
            } else {
                biome = "forest";
            }
            world[y][x] = BIOMES[biome];
            if (biome === "forest" && Math.random() < 0.05) {
                objects[y][x] = "tree";
            } else {
                objects[y][x] = null;
            }
        }
    }
}
generateWorld();

// ====================
// Sistema de Animales
// ====================
let animals = [];
let killCount = 0; // Recuento de animales cazados

const animalTypes = {
    // Ciervo: no agresivo, requiere 3 disparos para matar, se dibuja en marrón claro.
    deer: {
        health: 3,
        aggressive: false,
        color: "saddlebrown",
        width: 28,
        height: 28,
        speed: 0.2
    },
    // Jabalí: agresivo, requiere 2 disparos, ataca y quita 10 puntos de vida.
    boar: {
        health: 2,
        aggressive: true,
        damage: 10,
        color: "darkslategray",
        width: 30,
        height: 30,
        speed: 0.8,
        attackRange: 50,
        attackCooldown: 2000 // en milisegundos
    },
    // Conejo: muy frágil (1 disparo), no agresivo.
    rabbit: {
        health: 1,
        aggressive: false,
        color: "white",
        width: 20,
        height: 20,
        speed: 0.3
    }
};

function spawnAnimals(count = 20) {
    // Se intenta generar 'count' animales en posiciones aleatorias lejos del jugador
    for (let i = 0; i < count; i++) {
        const types = Object.keys(animalTypes);
        const type = types[Math.floor(Math.random() * types.length)];
        const props = animalTypes[type];
        let spawnX, spawnY, distance;
        do {
            spawnX = Math.random() * (WORLD_WIDTH * TILE_SIZE);
            spawnY = Math.random() * (WORLD_HEIGHT * TILE_SIZE);
            // Calculamos la distancia respecto a la posición inicial del jugador
            const playerInitX = Math.floor(WORLD_WIDTH / 2) * TILE_SIZE + 16;
            const playerInitY = Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE + 16;
            distance = Math.hypot(spawnX - playerInitX, spawnY - playerInitY);
        } while (distance < 300); // No se spawnean en un radio de 300px alrededor del jugador
        animals.push({
            type: type,
            x: spawnX,
            y: spawnY,
            width: props.width,
            height: props.height,
            health: props.health,
            maxHealth: props.health,
            aggressive: props.aggressive,
            color: props.color,
            speed: props.speed,
            lastAttackTime: 0,
            attackRange: props.attackRange || 0,
            attackCooldown: props.attackCooldown || 0,
            // Para animales no agresivos, se asigna un comportamiento de vagabundeo.
            wanderDir: Math.random() * 2 * Math.PI,
            wanderTimer: Math.floor(Math.random() * 120) + 60
        });
    }
}
spawnAnimals();

// ====================
// Variables de Proyectiles y Puntería
// ====================
let bullets = [];
let mouseX = 0, mouseY = 0;
let isAiming = false;  // Se activa al presionar el botón derecho

// ====================
// Definición del Jugador, sus Armas y Sistema de Salud
// ====================
const player = {
    x: Math.floor(WORLD_WIDTH / 2) * TILE_SIZE,
    y: Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE,
    width: 32,
    height: 32,
    speed: 4,
    color: "red",
    health: 100,
    maxHealth: 100,
    weapons: {
        rifle: {
            name: "Rifle de caza",
            magazine: 5,
            ammo: 5,
            reloadTime: 1000,  // 1 segundo
            isReloading: false,
            range: 500,
            autoReload: true
        },
        revolver: {
            name: "Revolver",
            magazine: 8,
            ammo: 8,
            reloadTime: 1500,  // 1.5 segundos
            isReloading: false,
            range: 200,
            autoReload: false
        }
    },
    currentWeapon: "rifle"
};

// ====================
// Manejo de Eventos
// ====================
const keys = {};
window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "1") {
        player.currentWeapon = "rifle";
    } else if (e.key === "2") {
        player.currentWeapon = "revolver";
    }
});
window.addEventListener("keyup", (e) => keys[e.key] = false);

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) { // Izquierdo: disparar
        shoot();
    } else if (e.button === 2) { // Derecho: activar puntería
        isAiming = true;
    }
});
canvas.addEventListener("mouseup", (e) => {
    if (e.button === 2) {
        isAiming = false;
    }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ====================
// Función de Disparo
// ====================
function shoot() {
    const weapon = player.weapons[player.currentWeapon];
    if (weapon.isReloading || weapon.ammo <= 0) return;
    
    // Calculamos el ángulo de apuntado (relativo al centro de la pantalla)
    let angle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
    
    // Centro del jugador (en el mundo)
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // El arma se dibuja en el lado izquierdo del jugador.
    const offsetDistance = player.width / 2; // Aproximadamente 16 píxeles
    let leftVecX = Math.cos(angle + Math.PI / 2);
    let leftVecY = Math.sin(angle + Math.PI / 2);
    // Posición del arma
    let weaponPosX = playerCenterX + leftVecX * offsetDistance;
    let weaponPosY = playerCenterY + leftVecY * offsetDistance;
    
    // Longitud del arma según el tipo (para que la bala salga de la punta)
    let gunLength = (player.currentWeapon === "rifle") ? 32 : 16;
    let bulletSpawnX = weaponPosX + Math.cos(angle) * gunLength;
    let bulletSpawnY = weaponPosY + Math.sin(angle) * gunLength;
    
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);
    
    let bullet = {
        x: bulletSpawnX,
        y: bulletSpawnY,
        dx: dx,
        dy: dy,
        speed: 10,
        range: weapon.range,
        traveled: 0,
        color: "black"
    };
    bullets.push(bullet);
    
    weapon.ammo--;
    weapon.isReloading = true;
    setTimeout(() => {
        weapon.isReloading = false;
        if (!weapon.autoReload && weapon.ammo <= 0) {
            weapon.ammo = weapon.magazine;
            console.log(weapon.name + " recargado.");
        }
    }, weapon.reloadTime);
}

// ====================
// Actualización
// ====================
function update() {
    // Movimiento del jugador
    if (keys["w"]) player.y -= player.speed;
    if (keys["s"]) player.y += player.speed;
    if (keys["a"]) player.x -= player.speed;
    if (keys["d"]) player.x += player.speed;
    
    // Evitar que el jugador se salga del mapa
    player.x = Math.max(0, Math.min(player.x, WORLD_WIDTH * TILE_SIZE - player.width));
    player.y = Math.max(0, Math.min(player.y, WORLD_HEIGHT * TILE_SIZE - player.height));
    
    // Actualizar proyectiles
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.dx * b.speed;
        b.y += b.dy * b.speed;
        b.traveled += b.speed;
        if (b.traveled >= b.range) {
            bullets.splice(i, 1);
        }
    }
    
    // Actualizar animales
    animals.forEach((animal, index) => {
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const dx = playerCenterX - animal.x;
        const dy = playerCenterY - animal.y;
        const dist = Math.hypot(dx, dy);
        
        if (animal.aggressive) {
            // Si el animal está dentro del rango de ataque, ataca
            if (dist < animal.attackRange) {
                const now = Date.now();
                if (now - animal.lastAttackTime > animal.attackCooldown) {
                    animal.lastAttackTime = now;
                    player.health -= animal.damage || 10;
                    console.log("¡Atacado por " + animal.type + "! Salud restante: " + player.health);
                    if (player.health < 0) player.health = 0;
                }
            } else {
                // Se mueve hacia el jugador
                animal.x += (dx / dist) * animal.speed;
                animal.y += (dy / dist) * animal.speed;
            }
        } else {
            // Animales no agresivos: movimiento de vagabundeo
            animal.x += Math.cos(animal.wanderDir) * animal.speed;
            animal.y += Math.sin(animal.wanderDir) * animal.speed;
            animal.wanderTimer--;
            if (animal.wanderTimer <= 0) {
                animal.wanderDir = Math.random() * 2 * Math.PI;
                animal.wanderTimer = Math.floor(Math.random() * 120) + 60;
            }
        }
    });
    
    // Colisiones entre balas y animales
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        animals.forEach((animal, aIndex) => {
            if (
                b.x > animal.x &&
                b.x < animal.x + animal.width &&
                b.y > animal.y &&
                b.y < animal.y + animal.height
            ) {
                animal.health -= 1;
                bullets.splice(i, 1);
                if (animal.health <= 0) {
                    animals.splice(aIndex, 1);
                    killCount++;
                    console.log("Mataste a un " + animal.type);
                }
            }
        });
    }
}

// ====================
// Dibujar
// ====================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Centro del jugador (en el mundo)
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Calculamos el ángulo de apuntado (usando la posición del mouse respecto al centro del canvas)
    let angle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
    
    // La cámara se centra en el jugador; si se apunta con el rifle, se desplaza hacia el objetivo.
    let cameraCenterX, cameraCenterY;
    if (isAiming && player.currentWeapon === "rifle") {
        const offsetX = (mouseX - canvas.width / 2) * 0.5;
        const offsetY = (mouseY - canvas.height / 2) * 0.5;
        cameraCenterX = playerCenterX + offsetX;
        cameraCenterY = playerCenterY + offsetY;
    } else {
        cameraCenterX = playerCenterX;
        cameraCenterY = playerCenterY;
    }
    const cameraX = Math.floor(cameraCenterX - canvas.width / 2);
    const cameraY = Math.floor(cameraCenterY - canvas.height / 2);
    
    // Dibujar el mundo (tiles y árboles)
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
            const tileX = x * TILE_SIZE - cameraX;
            const tileY = y * TILE_SIZE - cameraY;
            if (tileX + TILE_SIZE >= 0 && tileX < canvas.width &&
                tileY + TILE_SIZE >= 0 && tileY < canvas.height) {
                ctx.fillStyle = world[y][x].color;
                ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
                if (objects[y][x] === "tree") {
                    ctx.fillStyle = "#0B3D0B";
                    ctx.beginPath();
                    ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, TILE_SIZE / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    
    // Dibujar animales
    animals.forEach(animal => {
        const screenX = animal.x - cameraX;
        const screenY = animal.y - cameraY;
        ctx.fillStyle = animal.color;
        ctx.fillRect(screenX, screenY, animal.width, animal.height);
        // Barra de salud sobre el animal
        ctx.fillStyle = "red";
        ctx.fillRect(screenX, screenY - 5, (animal.health / animal.maxHealth) * animal.width, 3);
    });
    
    // Dibujar proyectiles
    bullets.forEach(b => {
        const bulletScreenX = b.x - cameraX;
        const bulletScreenY = b.y - cameraY;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(bulletScreenX, bulletScreenY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Dibujar al jugador (rotado según el ángulo de apuntado)
    ctx.save();
    ctx.translate(playerCenterX - cameraX, playerCenterY - cameraY);
    ctx.rotate(angle);
    // Dibujar el cuerpo del jugador (cuadrado centrado)
    ctx.fillStyle = player.color;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.restore();
    
    // Dibujar el arma en el lado izquierdo del jugador
    ctx.save();
    const offsetDistance = player.width / 2; // Desplazamiento para posicionar el arma a la izquierda
    let leftVecX = Math.cos(angle + Math.PI / 2);
    let leftVecY = Math.sin(angle + Math.PI / 2);
    let weaponPosX = playerCenterX - cameraX + leftVecX * offsetDistance;
    let weaponPosY = playerCenterY - cameraY + leftVecY * offsetDistance;
    ctx.translate(weaponPosX, weaponPosY);
    ctx.rotate(angle);
    if (player.currentWeapon === "rifle") {
        ctx.fillStyle = "brown"; // Rifle: rectángulo marrón de 32x4
        ctx.fillRect(0, -2, 32, 4);
    } else {
        ctx.fillStyle = "black"; // Revolver: rectángulo negro de 16x4
        ctx.fillRect(0, -2, 16, 4);
    }
    ctx.restore();
    
    // Si se está apuntando con el rifle, dibujar la línea de puntería
    if (isAiming && player.currentWeapon === "rifle") {
        const weaponRange = player.weapons[player.currentWeapon].range;
        const aimEndX = playerCenterX + Math.cos(angle) * weaponRange;
        const aimEndY = playerCenterY + Math.sin(angle) * weaponRange;
        ctx.strokeStyle = "rgba(255, 255, 0, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(playerCenterX - cameraX, playerCenterY - cameraY);
        ctx.lineTo(aimEndX - cameraX, aimEndY - cameraY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Dibujar el HUD
    drawHUD();
}

// ====================
// Dibujar HUD Mejorado
// ====================
function drawHUD() {
    const hudX = 10, hudY = 10, hudWidth = 260, hudHeight = 80;
    // Crear un degradado para el fondo del HUD
    const gradient = ctx.createLinearGradient(hudX, hudY, hudX + hudWidth, hudY);
    gradient.addColorStop(0, "#333");
    gradient.addColorStop(1, "#555");
    ctx.fillStyle = gradient;
    ctx.fillRect(hudX, hudY, hudWidth, hudHeight);
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(hudX, hudY, hudWidth, hudHeight);
    
    ctx.fillStyle = "white";
    ctx.font = "16px 'Pixelify Sans', sans-serif"; // Fuente mejorada
    const weapon = player.weapons[player.currentWeapon];
    ctx.fillText("Arma: " + weapon.name, hudX + 10, hudY + 20);
    ctx.fillText("Munición: " + weapon.ammo + " / " + weapon.magazine, hudX + 10, hudY + 40);
    ctx.fillText("Salud: " + player.health + " / " + player.maxHealth, hudX + 10, hudY + 60);
    ctx.fillText("Cacerías: " + killCount, hudX + 150, hudY + 20);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
