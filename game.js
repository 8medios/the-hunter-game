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
    // Sistema de Animales y Recuento de Cacerías
    // ====================
    let animals = [];
    let killCount = 0; // Contador de animales cazados

    const animalTypes = {
      // Ciervo: no agresivo, requiere 3 disparos para matar
      deer: {
        health: 3,
        aggressive: false,
        color: "saddlebrown",
        width: 28,
        height: 28,
        speed: 0.2
      },
      // Jabalí: agresivo, requiere 2 disparos y ataca al jugador
      boar: {
        health: 2,
        aggressive: true,
        damage: 10,
        color: "darkslategray",
        width: 30,
        height: 30,
        speed: 0.8,
        attackRange: 50,
        attackCooldown: 2000 // ms (ya no se usará para daño continuo)
      },
      // Conejo: muy frágil (1 disparo), no agresivo
      rabbit: {
        health: 1,
        aggressive: false,
        color: "white",
        width: 20,
        height: 20,
        speed: 0.3
      }
    };

    // Guardamos velocidad y daño base para ajustar en función del ciclo
    function spawnAnimals(count = 20) {
      for (let i = 0; i < count; i++) {
        const types = Object.keys(animalTypes);
        const type = types[Math.floor(Math.random() * types.length)];
        const props = animalTypes[type];
        let spawnX, spawnY, distance;
        do {
          spawnX = Math.random() * (WORLD_WIDTH * TILE_SIZE);
          spawnY = Math.random() * (WORLD_HEIGHT * TILE_SIZE);
          const playerInitX = Math.floor(WORLD_WIDTH / 2) * TILE_SIZE + 16;
          const playerInitY = Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE + 16;
          distance = Math.hypot(spawnX - playerInitX, spawnY - playerInitY);
        } while (distance < 300); // No cerca del jugador
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
          baseSpeed: props.speed, // velocidad base
          baseDamage: props.damage || 0, // daño base (para agresivos)
          lastAttackTime: 0,
          attackRange: props.attackRange || 0,
          attackCooldown: props.attackCooldown || 0,
          // Movimiento de vagabundeo
          wanderDir: Math.random() * 2 * Math.PI,
          wanderTimer: Math.floor(Math.random() * 120) + 60
        });
      }
    }
    // Aumentamos el spawn inicial
    spawnAnimals(60);

    // Variables para spawn periódico
    let lastSpawnTime = Date.now();
    const spawnInterval = 5000; // cada 5 segundos
    const maxAnimals = 200; // máximo animales en el mundo

    // ====================
    // Variables de Proyectiles y Puntería
    // ====================
    let bullets = [];
    let mouseX = 0, mouseY = 0;
    let isAiming = false;  // Se activa con botón derecho

    // ====================
    // Definición del Jugador, Armas y Sistema de Salud
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
          reloadTime: 1000,  // ms
          isReloading: false,
          range: 500,
          autoReload: true
        },
        revolver: {
          name: "Revolver",
          magazine: 8,
          ammo: 8,
          reloadTime: 1500,  // ms
          isReloading: false,
          range: 200,
          autoReload: false
        }
      },
      currentWeapon: "rifle"
    };

    // Variable para controlar el estado de "Game Over"
    let gameOver = false;

    // ====================
    // Ciclo Día/Noche y Contador de Días
    // ====================
    const cycleDuration = 600000; // 10 minutos en total (5 de día, 5 de noche)
    let currentBrightness = 1;    // Brillo actual (1 = día, ~0.3 = noche)
    let dayCount = 0;
    let lastCyclePhase = null;    // "day" o "night"

    function updateDayNight() {
      const now = Date.now();
      const timeCycle = (now % cycleDuration) / cycleDuration; // valor 0 a 1
      // Usamos una función coseno para suavizar la transición: 
      // Cuando timeCycle = 0 o 1 → cos(0)=1 → brillo=1, y cuando timeCycle = 0.5 → cos(pi)= -1 → brillo=0.3
      currentBrightness = 0.65 + 0.35 * Math.cos(2 * Math.PI * timeCycle);
      // Determinar fase: día si timeCycle < 0.5, noche si >= 0.5.
      let phase = (timeCycle < 0.5) ? "day" : "night";
      // Incrementar contador de días al inicio del día
      if (phase === "day" && lastCyclePhase !== "day") {
        dayCount++;
      }
      lastCyclePhase = phase;
    }

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
      if (weapon.isReloading || weapon.ammo <= 0 || gameOver) return;

      let angle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;
      const offsetDistance = player.width / 2;
      let leftVecX = Math.cos(angle + Math.PI / 2);
      let leftVecY = Math.sin(angle + Math.PI / 2);
      let weaponPosX = playerCenterX + leftVecX * offsetDistance;
      let weaponPosY = playerCenterY + leftVecY * offsetDistance;
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
      updateDayNight(); // Actualiza el ciclo día/noche y brillo

      if (gameOver) return;

      if (keys["w"]) player.y -= player.speed;
      if (keys["s"]) player.y += player.speed;
      if (keys["a"]) player.x -= player.speed;
      if (keys["d"]) player.x += player.speed;

      // Limitar al jugador dentro del mapa
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

      // Spawn periódico de animales (más si es noche)
      if (Date.now() - lastSpawnTime > spawnInterval && animals.length < maxAnimals) {
        let spawnCount = (currentBrightness < 0.5) ? 15 : 10;
        spawnAnimals(spawnCount);
        lastSpawnTime = Date.now();
      }

      // Actualizar animales
      animals.forEach((animal) => {
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const dx = playerCenterX - animal.x;
        const dy = playerCenterY - animal.y;
        const dist = Math.hypot(dx, dy);
        if (animal.aggressive) {
          // Ajustar velocidad y daño en la noche
          animal.speed = animal.baseSpeed * (currentBrightness < 0.5 ? 1.5 : 1);
          animal.damage = animal.baseDamage * (currentBrightness < 0.5 ? 1.5 : 1);
          if (dist < animal.attackRange) {
            // Ataque continuo: se resta daño proporcional (asumimos ~60 FPS)
            player.health -= animal.damage / 60;
            if (player.health <= 0) {
              player.health = 0;
              gameOver = true;
            }
          } else {
            animal.x += (dx / dist) * animal.speed;
            animal.y += (dy / dist) * animal.speed;
          }
        } else {
          // Movimiento de vagabundeo
          animal.x += Math.cos(animal.wanderDir) * animal.speed;
          animal.y += Math.sin(animal.wanderDir) * animal.speed;
          animal.wanderTimer--;
          if (animal.wanderTimer <= 0) {
            animal.wanderDir = Math.random() * 2 * Math.PI;
            animal.wanderTimer = Math.floor(Math.random() * 120) + 60;
          }
        }
      });

      // Colisiones entre animales (resolución simple)
      for (let i = 0; i < animals.length; i++) {
        for (let j = i + 1; j < animals.length; j++) {
          let a = animals[i], b = animals[j];
          if (rectIntersect(a, b)) {
            let centerAX = a.x + a.width / 2;
            let centerAY = a.y + a.height / 2;
            let centerBX = b.x + b.width / 2;
            let centerBY = b.y + b.height / 2;
            let overlapX = (a.width + b.width) / 2 - Math.abs(centerAX - centerBX);
            let overlapY = (a.height + b.height) / 2 - Math.abs(centerAY - centerBY);
            if (overlapX > 0 && overlapY > 0) {
              if (overlapX < overlapY) {
                if (centerAX < centerBX) {
                  a.x -= overlapX / 2;
                  b.x += overlapX / 2;
                } else {
                  a.x += overlapX / 2;
                  b.x -= overlapX / 2;
                }
              } else {
                if (centerAY < centerBY) {
                  a.y -= overlapY / 2;
                  b.y += overlapY / 2;
                } else {
                  a.y += overlapY / 2;
                  b.y -= overlapY / 2;
                }
              }
            }
          }
        }
      }

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

    function rectIntersect(a, b) {
      return !(
        a.x + a.width < b.x ||
        a.x > b.x + b.width ||
        a.y + a.height < b.y ||
        a.y > b.y + b.height
      );
    }

    // ====================
    // Dibujar
    // ====================
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;
      let angle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);

      // Cámara que sigue al jugador; si se apunta con el rifle, se desplaza hacia el objetivo
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

      // Dibujar mundo (tiles y árboles)
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

      // Dibujar al jugador (rotado según el ángulo)
      ctx.save();
      ctx.translate(playerCenterX - cameraX, playerCenterY - cameraY);
      ctx.rotate(angle);
      ctx.fillStyle = player.color;
      ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
      ctx.restore();

      // Dibujar el arma en el lado izquierdo del jugador
      ctx.save();
      const offsetDistance = player.width / 2;
      let leftVecX = Math.cos(angle + Math.PI / 2);
      let leftVecY = Math.sin(angle + Math.PI / 2);
      let weaponPosX = playerCenterX - cameraX + leftVecX * offsetDistance;
      let weaponPosY = playerCenterY - cameraY + leftVecY * offsetDistance;
      ctx.translate(weaponPosX, weaponPosY);
      ctx.rotate(angle);
      if (player.currentWeapon === "rifle") {
        ctx.fillStyle = "brown";
        ctx.fillRect(0, -2, 32, 4);
      } else {
        ctx.fillStyle = "black";
        ctx.fillRect(0, -2, 16, 4);
      }
      ctx.restore();

      // Línea de puntería (solo para rifle en modo apuntar)
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

      // Overlay para el ciclo noche (oscurece y añade tinte azul)
      if (currentBrightness < 1) {
        ctx.fillStyle = "rgba(0, 0, 64, " + (1 - currentBrightness) + ")";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Dibujar el HUD
      drawHUD();

      // Mostrar "Game Over" si el jugador murió
      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffcc00";
        ctx.font = "48px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "24px 'Press Start 2P', monospace";
        ctx.fillText("Cacerías: " + killCount, canvas.width / 2, canvas.height / 2 + 20);
      }
    }

    // ====================
    // Dibujar HUD (Estilo "Squirrel Stapler" mejorado)
    // ====================
    function drawHUD() {
      const hudX = 10, hudY = 10, hudWidth = 320, hudHeight = 140;
      // Fondo degradado
      const gradient = ctx.createLinearGradient(hudX, hudY, hudX + hudWidth, hudY);
      gradient.addColorStop(0, "#1a1a1a");
      gradient.addColorStop(1, "#333333");
      ctx.fillStyle = gradient;
      ctx.fillRect(hudX, hudY, hudWidth, hudHeight);
      
      // Borde retro
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 4;
      ctx.strokeRect(hudX, hudY, hudWidth, hudHeight);
      
      // Configurar la fuente "Press Start 2P"
      ctx.fillStyle = "#ffcc00";
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      const weapon = player.weapons[player.currentWeapon];
      ctx.fillText("Arma: " + weapon.name, hudX + 10, hudY + 30);
      ctx.fillText("Mun: " + weapon.ammo + "/" + weapon.magazine, hudX + 10, hudY + 50);
      ctx.fillText("Salud:", hudX + 10, hudY + 70);
      // Barra de salud del jugador
      const barWidth = 100, barHeight = 10;
      const healthPercent = player.health / player.maxHealth;
      ctx.strokeStyle = "#ffcc00";
      ctx.lineWidth = 2;
      ctx.strokeRect(hudX + 80, hudY + 60, barWidth, barHeight);
      ctx.fillStyle = "red";
      ctx.fillRect(hudX + 80, hudY + 60, barWidth * healthPercent, barHeight);
      
      ctx.fillText("Cacerías: " + killCount, hudX + 10, hudY + 90);
      ctx.fillText("Días: " + dayCount, hudX + 10, hudY + 110);
      ctx.fillText("Fase: " + ((currentBrightness < 0.5) ? "Noche" : "Día"), hudX + 150, hudY + 30);
      
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    function gameLoop() {
      update();
      draw();
      if (!gameOver) {
        requestAnimationFrame(gameLoop);
      } else {
        console.log("Game Over. Total de cacerías: " + killCount + ". Días sobrevividos: " + dayCount);
      }
    }

    gameLoop();