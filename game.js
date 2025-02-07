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
    const scale = 50;  // Este factor controla el tamaño de las regiones: a mayor escala, regiones más grandes.
    
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        world[y] = [];
        objects[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            // Calculamos el valor de ruido para la celda (valor aproximado entre -1 y 1)
            let n = noise.perlin2(x / scale, y / scale);
            let biome;
            
            // Definimos los umbrales para asignar variaciones:
            if (n < -0.3) {
                biome = "dirt";     // Por ejemplo, áreas de tierra
            } else if (n < 0) {
                biome = "grass1";   // Pasto variante 1
            } else if (n < 0.3) {
                biome = "grass2";   // Pasto variante 2
            } else {
                biome = "forest";   // Suelo de bosque (más “verde oscuro”)
            }
            
            world[y][x] = BIOMES[biome];
            
            // Colocamos un árbol en algunas celdas, solo en áreas de bosque
            // La probabilidad (aquí 5%) se puede ajustar para obtener la densidad deseada.
            if (biome === "forest" && Math.random() < 0.05) {
                objects[y][x] = "tree";
            } else {
                objects[y][x] = null;
            }
        }
    }
}
generateWorld();

const player = {
    x: Math.floor(WORLD_WIDTH / 2) * TILE_SIZE,
    y: Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE,
    width: 32,
    height: 32,
    speed: 4,
    color: "red"
};

const keys = {};
window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);

function update() {
    if (keys["w"]) player.y -= player.speed;
    if (keys["s"]) player.y += player.speed;
    if (keys["a"]) player.x -= player.speed;
    if (keys["d"]) player.x += player.speed;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculamos la posición de la cámara para centrar al jugador
    const cameraX = Math.floor(player.x - canvas.width / 2);
    const cameraY = Math.floor(player.y - canvas.height / 2);
    
    // Se recorren todas las celdas del mundo
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
            const tileX = x * TILE_SIZE - cameraX;
            const tileY = y * TILE_SIZE - cameraY;
            
            // Solo se dibujan los tiles que están dentro del canvas
            if (tileX + TILE_SIZE >= 0 && tileX < canvas.width &&
                tileY + TILE_SIZE >= 0 && tileY < canvas.height) {
                // Dibujar el suelo (tile)
                ctx.fillStyle = world[y][x].color;
                ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
                
                // Si hay un objeto (árbol) en la celda, dibujarlo
                if (objects[y][x] === "tree") {
                    ctx.fillStyle = "#0B3D0B";  // Color del árbol (puedes usar sprites si lo prefieres)
                    ctx.beginPath();
                    // Dibujamos un círculo centrado en el tile. El radio se ajusta para que no ocupe todo el tile.
                    ctx.arc(tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2, TILE_SIZE / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    
    // Dibujar al jugador (con su tamaño 32x32)
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x - cameraX, player.y - cameraY, player.width, player.height);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();