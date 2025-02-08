const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const TILE_SIZE = 32;
const WORLD_WIDTH = 500;
const WORLD_HEIGHT = 500;
const world = [];
const objects = [];

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

// Variables para proyectiles y puntería
let bullets = [];
let mouseX = 0, mouseY = 0;
let isAiming = false;  // Se activa al presionar el botón derecho

// Definición del jugador y sus armas
const player = {
    x: Math.floor(WORLD_WIDTH / 2) * TILE_SIZE,
    y: Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE,
    width: 32,
    height: 32,
    speed: 4,
    color: "red",
    weapons: {
        rifle: {
            name: "Rifle de caza",
            magazine: 5,
            ammo: 5,
            reloadTime: 1000,  // 1 segundo
            isReloading: false,
            range: 500,        // Largo alcance
            autoReload: true   // Cada disparo requiere recarga (espera entre disparos)
        },
        revolver: {
            name: "Revolver",
            magazine: 8,
            ammo: 8,
            reloadTime: 1500,  // 1.5 segundos
            isReloading: false,
            range: 200,        // Corto alcance
            autoReload: false  // Se recarga solo al agotarse la munición
        }
    },
    currentWeapon: "rifle"
};

// Manejo de teclado
const keys = {};
window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    // Cambiar arma: "1" para rifle, "2" para revolver
    if (e.key === "1") {
        player.currentWeapon = "rifle";
    } else if (e.key === "2") {
        player.currentWeapon = "revolver";
    }
});
window.addEventListener("keyup", (e) => keys[e.key] = false);

// Actualizar posición del mouse (coordenadas de pantalla)
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Manejo de disparo y puntería:
// - Botón izquierdo para disparar
// - Botón derecho para activar/desactivar modo apuntar
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

function shoot() {
    const weapon = player.weapons[player.currentWeapon];
    if (weapon.isReloading || weapon.ammo <= 0) return;
    
    // Calculamos el ángulo de apuntado (relativo al centro de la pantalla)
    let angle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
    
    // Centro del jugador (en el mundo)
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Desplazamiento hacia la izquierda (para tener el arma en el lado izquierdo del cuerpo)
    const offsetDistance = player.width / 2; // 16 píxeles aproximadamente
    let leftVecX = Math.cos(angle + Math.PI / 2);
    let leftVecY = Math.sin(angle + Math.PI / 2);
    
    // Posición del arma (en el mundo)
    let weaponPosX = playerCenterX + leftVecX * offsetDistance;
    let weaponPosY = playerCenterY + leftVecY * offsetDistance;
    
    // Longitud del arma según tipo
    let gunLength = (player.currentWeapon === "rifle") ? 32 : 16;
    
    // La bala sale desde la punta del arma:
    let bulletSpawnX = weaponPosX + Math.cos(angle) * gunLength;
    let bulletSpawnY = weaponPosY + Math.sin(angle) * gunLength;
    
    // Dirección del disparo (basada en el ángulo de apuntado)
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
        color: "black" // Balas de color negro (puedes cambiarlo)
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

function update() {
    if (keys["w"]) player.y -= player.speed;
    if (keys["s"]) player.y += player.speed;
    if (keys["a"]) player.x -= player.speed;
    if (keys["d"]) player.x += player.speed;
    
    // Actualizar proyectiles: se mueven y se eliminan al superar su rango
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.dx * b.speed;
        b.y += b.dy * b.speed;
        b.traveled += b.speed;
        if (b.traveled >= b.range) {
            bullets.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Centro del jugador (en el mundo)
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Calculamos el ángulo de apuntado (usamos la posición del mouse respecto al centro del canvas)
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
    
    // Dibujar los proyectiles
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
    // Se dibuja el cuadrado del jugador centrado en (0,0)
    ctx.fillStyle = player.color;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.restore();
    
    // Dibujar el arma en el lado izquierdo del jugador
    ctx.save();
    // Calculamos la posición del arma: desde el centro del jugador se desplaza hacia la izquierda
    const offsetDistance = player.width / 2; // Ajustable (aquí 16 px)
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
    
    // Dibujar el HUD minimalista
    drawHUD();
}

function drawHUD() {
    const weapon = player.weapons[player.currentWeapon];
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10, 10, 220, 50);
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Arma: " + weapon.name, 20, 30);
    ctx.fillText("Munición: " + weapon.ammo + " / " + weapon.magazine, 20, 50);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
