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
      const scale = 50;
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        world[y] = [];
        objects[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
          let n = noise.perlin2(x / scale, y / scale);
          let biome;
          if (n < -0.3) biome = "dirt";
          else if (n < 0) biome = "grass1";
          else if (n < 0.3) biome = "grass2";
          else biome = "forest";
          world[y][x] = BIOMES[biome];
          objects[y][x] = (biome === "forest" && Math.random() < 0.05) ? "tree" : null;
        }
      }
    }
    generateWorld();

    // ====================
    // Variables para ciclo día/noche y dificultad
    // ====================
    const cycleDuration = 600000; // 10 minutos en total (5 de día, 5 de noche)
    let currentBrightness = 1;    // 1 = día, ~0.3 = noche
    let currentPhase = "day";     // "day" o "night"
    let lastCyclePhase = "";
    let fullMoon = false;         // Activa si dayCount % 5 === 0
    let dayCount = 1;             // Contador de días, inicia en 1
    let gameTimeStr = "";         // Reloj del juego (hora)
    
    let dayIncremented = false;  // Variable para evitar múltiples incrementos en el mismo ciclo

    function updateDayNight() {
        const now = Date.now();
        // Valor de 0 a 1 en un ciclo de cycleDuration (10 min)
        let timeCycle = (now % cycleDuration) / cycleDuration;
  
        // Desplazamiento de 6 horas: timeCycle=0 → 6:00 AM
        // totalHours irá de 6 a 30, y con %24 se queda en [0..24)
        let totalHours = ((timeCycle * 24) + 6) % 24;
  
        // Definir el brillo con coseno, usando timeCycle + offset
        // (Opcional) Queremos que a las 6 AM sea brillo máximo:
        // definimos un shift de + 0.25 para alinear la curva cos.
        // Aun así, lo ajustamos para tener una transición suave.
        let shifted = (timeCycle + 0.25) % 1; 
        currentBrightness = 0.65 + 0.35 * Math.cos(2 * Math.PI * shifted);
  
        // Determinar la fase (día de 6 a 18, noche resto)
        if (totalHours >= 6 && totalHours < 18) {
          currentPhase = "day";
        } else {
          currentPhase = "night";
        }
  
        // Comprobamos si hemos pasado por la medianoche (totalHours cerca de 0)
        // Si totalHours < 0.1 => incrementa día una vez
        if (totalHours < 0.1 && !dayIncremented) {
          dayCount++;
          dayIncremented = true;
        } else if (totalHours >= 0.1) {
          dayIncremented = false;
        }
  
        // Luna llena cada 5 días
        fullMoon = (dayCount % 5 === 0);
  
        // Calcular el reloj del juego (12h AM/PM)
        let gameHour = Math.floor(totalHours);
        let gameMinute = Math.floor((totalHours - gameHour) * 60);
        let displayHour = gameHour % 12;
        if (displayHour === 0) displayHour = 12;
        let period = (gameHour < 12) ? "AM" : "PM";
        let minuteStr = gameMinute < 10 ? "0" + gameMinute : gameMinute;
        gameTimeStr = displayHour + ":" + minuteStr + " " + period;
      }
    
    // ====================
    // Sistema de Animales y Recuento de Cacerías
    // ====================
    let animals = [];
    let killCount = 0;

    const animalTypes = {
      deer: {
        health: 3,
        aggressive: false,
        color: "saddlebrown",
        width: 28,
        height: 28,
        speed: 0.2
      },
      boar: {
        health: 2,
        aggressive: true,
        damage: 10,
        color: "darkslategray",
        width: 30,
        height: 30,
        speed: 0.8,
        attackRange: 50,
        attackCooldown: 2000
      },
      rabbit: {
        health: 1,
        aggressive: false,
        color: "white",
        width: 20,
        height: 20,
        speed: 0.3
      }
    };

    // Nuevo enemigo para luna llena: wolf
    const wolfType = {
      health: 4,
      aggressive: true,
      damage: 20,
      color: "gray",
      width: 30,
      height: 30,
      speed: 1.2,
      attackRange: 60,
      attackCooldown: 0
    };

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
        } while (distance < 300);
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
          baseSpeed: props.speed,
          baseDamage: props.damage || 0,
          lastAttackTime: 0,
          attackRange: props.attackRange || 0,
          attackCooldown: props.attackCooldown || 0,
          wanderDir: Math.random() * 2 * Math.PI,
          wanderTimer: Math.floor(Math.random() * 120) + 60
        });
      }
    }
    spawnAnimals(60);

    // Función para spawnear enemigos nuevos (wolves) en luna llena
    let lastWolfSpawnTime = 0;
    const wolfSpawnInterval = 15000; // cada 15 segundos
    function spawnWolves(count = 5) {
      for (let i = 0; i < count; i++) {
        let spawnX, spawnY, distance;
        do {
          spawnX = Math.random() * (WORLD_WIDTH * TILE_SIZE);
          spawnY = Math.random() * (WORLD_HEIGHT * TILE_SIZE);
          const playerInitX = Math.floor(WORLD_WIDTH / 2) * TILE_SIZE + 16;
          const playerInitY = Math.floor(WORLD_HEIGHT / 2) * TILE_SIZE + 16;
          distance = Math.hypot(spawnX - playerInitX, spawnY - playerInitY);
        } while (distance < 300);
        animals.push({
          type: "wolf",
          x: spawnX,
          y: spawnY,
          width: wolfType.width,
          height: wolfType.height,
          health: wolfType.health,
          maxHealth: wolfType.health,
          aggressive: wolfType.aggressive,
          color: wolfType.color,
          speed: wolfType.speed,
          baseSpeed: wolfType.speed,
          baseDamage: wolfType.damage,
          lastAttackTime: 0,
          attackRange: wolfType.attackRange,
          attackCooldown: wolfType.attackCooldown,
          wanderDir: Math.random() * 2 * Math.PI,
          wanderTimer: Math.floor(Math.random() * 120) + 60
        });
      }
    }

    // Variables para spawn periódico
    let lastSpawnTime = Date.now();
    const spawnInterval = 5000; // cada 5 segundos
    const maxAnimals = 200;

    // ====================
    // Variables de Proyectiles y Puntería
    // ====================
    let bullets = [];
    let mouseX = 0, mouseY = 0;
    let isAiming = false;

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
          reloadTime: 1000,
          isReloading: false,
          range: 500,
          autoReload: true
        },
        revolver: {
          name: "Revolver",
          magazine: 8,
          ammo: 8,
          reloadTime: 1500,
          isReloading: false,
          range: 200,
          autoReload: false
        }
      },
      currentWeapon: "rifle"
    };

    let gameOver = false;

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
      if (e.button === 0) {
        shoot();
      } else if (e.button === 2) {
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
      updateDayNight();

      if (gameOver) return;

      if (keys["w"]) player.y -= player.speed;
      if (keys["s"]) player.y += player.speed;
      if (keys["a"]) player.x -= player.speed;
      if (keys["d"]) player.x += player.speed;

      player.x = Math.max(0, Math.min(player.x, WORLD_WIDTH * TILE_SIZE - player.width));
      player.y = Math.max(0, Math.min(player.y, WORLD_HEIGHT * TILE_SIZE - player.height));

      for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.dx * b.speed;
        b.y += b.dy * b.speed;
        b.traveled += b.speed;
        if (b.traveled >= b.range) {
          bullets.splice(i, 1);
        }
      }

      if (Date.now() - lastSpawnTime > spawnInterval && animals.length < maxAnimals) {
        let spawnCount = (currentBrightness < 0.5) ? 15 : 10;
        spawnAnimals(spawnCount);
        lastSpawnTime = Date.now();
      }
      if (currentPhase === "night" && fullMoon && Date.now() - lastWolfSpawnTime > wolfSpawnInterval && animals.length < maxAnimals) {
        spawnWolves(5);
        lastWolfSpawnTime = Date.now();
      }

      let difficultyMultiplier = 1 + (dayCount - 1) * 0.1;
      if (currentPhase === "night" && fullMoon) difficultyMultiplier *= 1.5;

      animals.forEach((animal) => {
        const playerCenterX = player.x + player.width / 2;
        const playerCenterY = player.y + player.height / 2;
        const dx = playerCenterX - animal.x;
        const dy = playerCenterY - animal.y;
        const dist = Math.hypot(dx, dy);
        if (animal.aggressive) {
          animal.speed = animal.baseSpeed * difficultyMultiplier;
          animal.damage = animal.baseDamage * difficultyMultiplier;
          if (dist < animal.attackRange) {
            // Ataque continuo: daño por frame (asumiendo ~60 FPS)
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
          animal.x += Math.cos(animal.wanderDir) * animal.speed;
          animal.y += Math.sin(animal.wanderDir) * animal.speed;
          animal.wanderTimer--;
          if (animal.wanderTimer <= 0) {
            animal.wanderDir = Math.random() * 2 * Math.PI;
            animal.wanderTimer = Math.floor(Math.random() * 120) + 60;
          }
        }
      });

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
    // Actualizar Día/Noche y Reloj del Juego
    // ====================
    function updateDayNight() {
        const now = Date.now();
        const timeCycle = (now % cycleDuration) / cycleDuration; // 0 a 1
        currentBrightness = 0.65 + 0.35 * Math.cos(2 * Math.PI * timeCycle);
        currentPhase = (timeCycle < 0.5) ? "day" : "night";
        
        if (currentPhase === "day" && lastCyclePhase !== "day") {
            dayCount++;
        }
        
        lastCyclePhase = currentPhase;
        fullMoon = (dayCount % 5 === 0);
        
        // Calcular reloj del juego (24 horas distribuidas en el ciclo)
        const totalHours = timeCycle * 24;
        const gameHour = Math.floor(totalHours);
        const gameMinute = Math.floor((totalHours - gameHour) * 60);
        
        let displayHour = gameHour % 12;
        if (displayHour === 0) displayHour = 12;
        
        // Corregir la lógica de AM/PM
        const period = (gameHour < 12) ? "AM" : "PM";
        
        const minuteStr = gameMinute < 10 ? "0" + gameMinute : gameMinute;
        gameTimeStr = displayHour + ":" + minuteStr + " " + period;
    }

    // ====================
    // Dibujar
    // ====================
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;
      let angle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);

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

      animals.forEach(animal => {
        const screenX = animal.x - cameraX;
        const screenY = animal.y - cameraY;
        ctx.fillStyle = animal.color;
        ctx.fillRect(screenX, screenY, animal.width, animal.height);
        ctx.fillStyle = "red";
        ctx.fillRect(screenX, screenY - 5, (animal.health / animal.maxHealth) * animal.width, 3);
      });

      bullets.forEach(b => {
        const bulletScreenX = b.x - cameraX;
        const bulletScreenY = b.y - cameraY;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(bulletScreenX, bulletScreenY, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.save();
      ctx.translate(playerCenterX - cameraX, playerCenterY - cameraY);
      ctx.rotate(angle);
      ctx.fillStyle = player.color;
      ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
      ctx.restore();

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

      if (currentBrightness < 1) {
        ctx.fillStyle = "rgba(0, 0, 64, " + (1 - currentBrightness) + ")";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      drawHUD();

      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffcc00";
        ctx.font = "48px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "24px 'Press Start 2P', monospace";
        ctx.fillText("Cacerías: " + killCount + " | Días: " + dayCount, canvas.width / 2, canvas.height / 2 + 20);
      }
    }

    function drawHUD() {
      // Textos en la esquina superior izquierda
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffcc00";
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.fillText("Arma: " + player.weapons[player.currentWeapon].name, 10, 20);
      ctx.fillText("Mun: " + player.weapons[player.currentWeapon].ammo + "/" + player.weapons[player.currentWeapon].magazine, 10, 40);
      ctx.fillText("Salud: " + Math.floor(player.health), 10, 60);
      ctx.fillText("Fase: " + ((currentBrightness < 0.5) ? "Noche" : "Día") + (fullMoon ? " (Luna Llena)" : ""), 10, 80);
      // Textos en la esquina superior derecha
      ctx.textAlign = "right";
      ctx.fillText("Días: " + dayCount, canvas.width - 10, 20);
      ctx.fillText("Hora: " + gameTimeStr, canvas.width - 10, 40);
    }

    function gameLoop() {
      updateDayNight();
      update();
      draw();
      if (!gameOver) {
        requestAnimationFrame(gameLoop);
      } else {
        console.log("Game Over. Cacerías: " + killCount + ", Días: " + dayCount);
      }
    }

    gameLoop();