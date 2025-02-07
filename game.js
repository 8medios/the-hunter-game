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

// Definición de biomas (colores)
const BIOMES = {
    "dirt": { color: "#78451A" },
    "grass1": { color: "#4A8A22" },
    "grass2": { color: "#5DAA2A" },
    "forest": { color: "#184A22" }
};

// Inicializamos el ruido (se asume que noisejs está incluido en el HTML)
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
            
            // Colocamos un árbol en algunas celdas del bioma "forest"
            if (biome === "forest" && Math.random() < 0.05) {
                objects[y][x] = "tree";
            } else {
                objects[y][x] = null;
            }
        }
    }
}
generateWorld();

// Variables para manejo de proyectiles y puntería
let bullets = [];         // Array para almacenar las balas
let mouseX = 0, mouseY = 0; // Posición del mouse en pantalla
let isAiming = false;     // Indica si se está en modo puntería (botón derecho)

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
            ammo: 5,           // Capacidad inicial
            reloadTime: 1000,  // Tiempo de recarga en milisegundos (1 s)
            isReloading: false,
            range: 500,        // Largo alcance
            autoReload: true   // Cada disparo requiere recarga
        },
        revolver: {
            name: "Revolver",
            magazine: 8,
            ammo: 8,           // Capacidad inicial
            reloadTime: 1500,  // Tiempo de recarga (1.5 s)
            isReloading: false,
            range: 200,        // Corto alcance
            autoReload: false  // Se recarga solo al agotarse la munición
        }
    },
    currentWeapon: "rifle" // Arma por defecto
};

// Manejo de teclado para mover al jugador y cambiar de arma
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

// Actualización de la posición del mouse (en pantalla)
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Manejo de disparo y puntería con el mouse:
// - Izquierdo para disparar
// - Derecho para activar la puntería (para el rifle)
canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) { // Botón izquierdo: disparar
        shoot();
    } else if (e.button === 2) { // Botón derecho: activar puntería
        isAiming = true;
    }
});
canvas.addEventListener("mouseup", (e) => {
    if (e.button === 2) { // Al soltar el botón derecho, se desactiva la puntería
        isAiming = false;
    }
});
// Evitamos el menú contextual del botón derecho
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Función para disparar: se calcula la dirección desde el centro del jugador
// hasta la posición del mouse (convertida a coordenadas del mundo) y se crea una bala.
function shoot() {
    const weapon = player.weapons[player.currentWeapon];
    if (weapon.isReloading || weapon.ammo <= 0) {
        return;
    }
    
    // Calculamos la cámara (para convertir las coordenadas de la pantalla a las del mundo)
    const cameraX = Math.floor(player.x - canvas.width / 2);
    const cameraY = Math.floor(player.y - canvas.height / 2);
    
    // Coordenadas del centro del jugador (en el mundo)
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    
    // Convertimos la posición del mouse a coordenadas del mundo
    const targetX = cameraX + mouseX;
    const targetY = cameraY + mouseY;
    
    // Calculamos el vector dirección
    let dx = targetX - playerCenterX;
    let dy = targetY - playerCenterY;
    let length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return; // Evitar división por cero
    dx /= length;
    dy /= length;
    
    // Creamos la bala con parámetros según el arma actual
    let bullet = {
        x: playerCenterX,
        y: playerCenterY,
        dx: dx,
        dy: dy,
        speed: 10,             // Velocidad de la bala
        range: weapon.range,   // Alcance según arma
        traveled: 0,
        color: player.currentWeapon === "rifle" ? "black" : "black"
    };
    bullets.push(bullet);
    
    // Consumir una bala y activar el estado de recarga
    weapon.ammo--;
    weapon.isReloading = true;
    setTimeout(() => {
        weapon.isReloading = false;
        // En el revolver se recarga automáticamente al agotarse
        if (!weapon.autoReload && weapon.ammo <= 0) {
            weapon.ammo = weapon.magazine;
            console.log(weapon.name + " recargado.");
        }
    }, weapon.reloadTime);
}

// Función update: se actualiza la posición del jugador y se mueven las balas.
function update() {
    if (keys["w"]) player.y -= player.speed;
    if (keys["s"]) player.y += player.speed;
    if (keys["a"]) player.x -= player.speed;
    if (keys["d"]) player.x += player.speed;
    
    // Actualización de balas: se mueven y se eliminan cuando alcanzan su rango
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

// Función draw: dibuja el mundo, el jugador, las balas, la línea de puntería (si aplica) y el HUD.
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cameraX = Math.floor(player.x - canvas.width / 2);
    const cameraY = Math.floor(player.y - canvas.height / 2);
    
    // Dibujamos el mundo (tiles y árboles)
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
    
    // Dibujamos las balas
    bullets.forEach(b => {
        const bulletScreenX = b.x - cameraX;
        const bulletScreenY = b.y - cameraY;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(bulletScreenX, bulletScreenY, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Dibujamos al jugador
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - cameraX, player.y - cameraY, player.width, player.height);
    
    // Si se está apuntando con el rifle, dibujamos la línea de puntería
    if (isAiming && player.currentWeapon === "rifle") {
        // Centro del jugador en coordenadas del mundo
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        // Convertir la posición del mouse a coordenadas del mundo
        const targetX = cameraX + mouseX;
        const targetY = cameraY + mouseY;
        let dx = targetX - playerCenterX;
        let dy = targetY - playerCenterY;
        let len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) len = 1;
        dx /= len;
        dy /= len;
        // Punto final de la línea, limitado al alcance del arma
        const weaponRange = player.weapons[player.currentWeapon].range;
        const aimEndX = playerCenterX + dx * weaponRange;
        const aimEndY = playerCenterY + dy * weaponRange;
        ctx.strokeStyle = "rgba(255, 255, 0, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(playerCenterX - cameraX, playerCenterY - cameraY);
        ctx.lineTo(aimEndX - cameraX, aimEndY - cameraY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Dibujamos el HUD minimalista
    drawHUD();
}

// Función para dibujar el HUD (nombre del arma y munición)
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
