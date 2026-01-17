import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    // Load tower sprite sheet
    // towers.png contains all tower sprites in a single image
    // Frame size: adjust these values to match your sprite sheet dimensions
    // Common sizes: 128x128, 256x256, or custom dimensions
    // 100x100 is the size of the tower sprites in the sprite sheet
    const frameWidth = 100;  // Width of each frame in pixels
    const frameHeight = 100; // Height of each frame in pixels
    
    this.load.spritesheet("towers", "/towers/towers.png", {
      frameWidth: frameWidth,
      frameHeight: frameHeight
    });
    
    // Add load event listeners for debugging
    this.load.on("filecomplete", (key: string, type: string) => {
      console.log(`BootScene: Successfully loaded ${type} with key "${key}"`);
    });
    
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn(`BootScene: Failed to load file: ${file.key} from ${file.src}`);
      console.warn(`  This is OK if you haven't added the sprite files yet. The game will use geometric shapes instead.`);
    });
    
    // Load enemy sprite sheets
    // Each enemy has walking and death animations
    // Frame size: adjust if your enemy sprites use different dimensions
    const enemyFrameWidth = 48;  // Default for bee and ogre
    const enemyFrameHeight = 48; // Default for bee and ogre
    
    // Slime enemy (replaces Circle) - uses 16x16 frames
    const slimeFrameWidth = 48;
    const slimeFrameHeight = 48;
    
    this.load.spritesheet("slime-walk-up", "/enemies/slime-enemy/U_Walk.png", {
      frameWidth: slimeFrameWidth,
      frameHeight: slimeFrameHeight
    });
    this.load.spritesheet("slime-walk-down", "/enemies/slime-enemy/D_Walk.png", {
      frameWidth: slimeFrameWidth,
      frameHeight: slimeFrameHeight
    });
    this.load.spritesheet("slime-walk-side", "/enemies/slime-enemy/S_Walk.png", {
      frameWidth: slimeFrameWidth,
      frameHeight: slimeFrameHeight
    });
    this.load.spritesheet("slime-death-up", "/enemies/slime-enemy/U_Death.png", {
      frameWidth: slimeFrameWidth,
      frameHeight: slimeFrameHeight
    });
    this.load.spritesheet("slime-death-down", "/enemies/slime-enemy/D_Death.png", {
      frameWidth: slimeFrameWidth,
      frameHeight: slimeFrameHeight
    });
    this.load.spritesheet("slime-death-side", "/enemies/slime-enemy/S_Death.png", {
      frameWidth: slimeFrameWidth,
      frameHeight: slimeFrameHeight
    });
    
    // Bee enemy (replaces Triangle)
    this.load.spritesheet("bee-walk-up", "/enemies/bee-enemy/U_Walk.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("bee-walk-down", "/enemies/bee-enemy/D_Walk.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("bee-walk-side", "/enemies/bee-enemy/S_Walk.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("bee-death-up", "/enemies/bee-enemy/U_Death.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("bee-death-down", "/enemies/bee-enemy/D_Death.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("bee-death-side", "/enemies/bee-enemy/S_Death.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    
    // Ogre enemy (replaces Square)
    this.load.spritesheet("ogre-walk-up", "/enemies/ogre-enemy/U_Walk.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("ogre-walk-down", "/enemies/ogre-enemy/D_Walk.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("ogre-walk-side", "/enemies/ogre-enemy/S_Walk.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("ogre-death-up", "/enemies/ogre-enemy/U_Death.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("ogre-death-down", "/enemies/ogre-enemy/D_Death.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
    this.load.spritesheet("ogre-death-side", "/enemies/ogre-enemy/S_Death.png", {
      frameWidth: enemyFrameWidth,
      frameHeight: enemyFrameHeight
    });
  }

  create() {
    // Log all loaded textures for debugging
    console.log("BootScene: All loaded textures:", Object.keys(this.textures.list));
    
    // Check if sprite sheets loaded
    if (this.textures.exists("towers")) {
      const texture = this.textures.get("towers");
      console.log("BootScene: Tower sprite sheet loaded successfully");
      console.log(`  Total frames: ${texture.frameTotal}`);
    }
    
    // Log slime sprite dimensions for debugging
    if (this.textures.exists("slime-walk-down")) {
      const slimeTexture = this.textures.get("slime-walk-down");
      const slimeSource = slimeTexture.source[0];
      const firstFrame = slimeTexture.get(0);
      console.log("=== SLIME SPRITE DIMENSIONS ===");
      console.log(`Full texture size: ${slimeSource.width} x ${slimeSource.height} pixels`);
      if (firstFrame) {
        console.log(`Frame size (detected): ${firstFrame.width} x ${firstFrame.height} pixels`);
      }
      console.log(`Total frames detected: ${slimeTexture.frameTotal}`);
      if (firstFrame) {
        console.log(`Frames per row: ${Math.floor(slimeSource.width / firstFrame.width)}`);
        console.log(`Frames per column: ${Math.floor(slimeSource.height / firstFrame.height)}`);
      }
      console.log(`Current frame size setting: 16 x 16 pixels (slime-specific)`);
      console.log("==============================");
    }
    
    // Create enemy animations
    this.createEnemyAnimations();
    
    this.scene.start("MainMenu");
  }

  private createEnemyAnimations() {
    // Slime enemy animations (Circle replacement)
    // frameRate: frames per second (higher = faster animation)
    this.createDirectionalAnimations("slime", "walk", 8, true); // 8 fps for walking, repeat infinitely
    this.createDirectionalAnimations("slime", "death", 6, false); // 6 fps for death, play once
    
    // Bee enemy animations (Triangle replacement)
    this.createDirectionalAnimations("bee", "walk", 10, true); // 10 fps for walking
    this.createDirectionalAnimations("bee", "death", 8, false); // 8 fps for death
    
    // Ogre enemy animations (Square replacement)
    this.createDirectionalAnimations("ogre", "walk", 8, true); // 8 fps for walking
    this.createDirectionalAnimations("ogre", "death", 6, false); // 6 fps for death
  }

  private createDirectionalAnimations(enemyType: string, animationType: string, frameRate: number, repeat: boolean) {
    const directions = ["up", "down", "side"];
    
    for (const direction of directions) {
      const key = `${enemyType}-${animationType}-${direction}`;
      if (this.textures.exists(key)) {
        const texture = this.textures.get(key);
        const frameCount = texture.frameTotal;
        
        if (frameCount > 0) {
          const animKey = `${enemyType}-${animationType}-${direction}`;
          try {
            // Check if animation already exists to avoid duplicates
            if (!this.anims.exists(animKey)) {
              // Generate all frames from the sprite sheet (0 to frameCount-1)
              const frames = this.anims.generateFrameNumbers(key, { 
                start: 0, 
                end: frameCount - 1 
              });
              
              this.anims.create({
                key: animKey,
                frames: frames,
                frameRate: frameRate,
                repeat: repeat ? -1 : 0, // -1 = infinite repeat (cycles through all frames), 0 = play once
                yoyo: false, // Don't reverse the animation - just cycle forward
                showOnStart: true,
                hideOnComplete: false
              });
              
              console.log(`✓ Created animation: ${animKey} with ${frameCount} frames at ${frameRate} fps (repeat: ${repeat ? 'yes - cycles through all frames' : 'no - plays once'})`);
            } else {
              console.log(`Animation ${animKey} already exists`);
            }
          } catch (error) {
            console.error(`Failed to create animation ${animKey}:`, error);
          }
        } else {
          console.warn(`⚠ Texture ${key} has no frames detected. Check frame size settings.`);
        }
      } else {
        console.warn(`⚠ Texture ${key} does not exist`);
      }
    }
  }
}
