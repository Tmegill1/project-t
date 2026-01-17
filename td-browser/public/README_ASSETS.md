# Adding Sprites to Your Game

## Quick Start

1. **Add your sprite images** to the `public/` folder (see structure below)
2. **Uncomment and update the load paths** in `src/scenes/BootScene.ts`
3. **The game will automatically use sprites** if they're loaded, otherwise it falls back to geometric shapes

## Where to Put Sprite Images

Place your sprite images in the `public/` folder. For example:
- `public/towers/basic-tower.png`
- `public/towers/fast-tower.png`
- `public/towers/long-range-tower.png`
- `public/enemies/circle-enemy.png`
- `public/enemies/triangle-enemy.png`
- `public/enemies/square-enemy.png`

## Image Requirements

- **Format**: PNG (required for transparency) - JPG does NOT support transparency
- **Size**: Recommended sizes:
  - Towers: 64x64 to 128x128 pixels
  - Enemies: 32x32 to 64x64 pixels
- **Transparency**: **CRITICAL** - Your PNG images MUST have transparent backgrounds, not black or colored backgrounds
  - If your images have a black background, you need to edit them to remove it
  - Use an image editor (Photoshop, GIMP, Paint.NET, etc.) to:
    1. Select the black background
    2. Delete it or make it transparent
    3. Save as PNG with alpha channel enabled
  - The game will display whatever background color is in your image file
- **Naming**: Use the exact names listed below for automatic detection

## Example Sprite Structure

```
public/
  ├── towers/
  │   ├── basic-tower.png
  │   ├── fast-tower.png
  │   └── long-range-tower.png
  └── enemies/
      ├── circle-enemy.png
      ├── triangle-enemy.png
      └── square-enemy.png
```

## Loading Sprites

1. Open `src/scenes/BootScene.ts`
2. Uncomment the `this.load.image()` lines in the `preload()` method
3. Update the paths to match your file structure

Example:
```typescript
preload() {
  // Load tower sprites
  this.load.image("basic-tower", "/towers/basic-tower.png");
  this.load.image("fast-tower", "/towers/fast-tower.png");
  this.load.image("long-range-tower", "/towers/long-range-tower.png");
  
  // Load enemy sprites
  this.load.image("circle-enemy", "/enemies/circle-enemy.png");
  this.load.image("triangle-enemy", "/enemies/triangle-enemy.png");
  this.load.image("square-enemy", "/enemies/square-enemy.png");
}
```

## Sprite Keys (Required Names)

The code automatically checks for these sprite keys:

**Towers:**
- `"basic-tower"` - Basic Tower
- `"fast-tower"` - Fast Tower
- `"long-range-tower"` - Long Range Tower

**Enemies:**
- `"circle-enemy"` - Circle Enemy
- `"triangle-enemy"` - Triangle Enemy
- `"square-enemy"` - Square Enemy

## How It Works

- The game automatically detects if a sprite texture exists
- If a sprite is found, it uses the sprite image
- If no sprite is found, it falls back to the original geometric shapes (hexagons, circles, etc.)
- No code changes needed beyond loading the sprites in `BootScene.ts`

## Testing

1. Add your sprite images to `public/`
2. Update `BootScene.ts` to load them
3. Run the game - sprites should appear automatically
4. If sprites don't appear, check:
   - File paths are correct
   - Sprite keys match exactly (case-sensitive)
   - Images are valid PNG/JPG files
