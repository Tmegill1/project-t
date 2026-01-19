import Phaser from "phaser";
import { GRID_COLS, TILE_SIZE } from "../../game/data/demoMap";
import { BasicTower, FastTower, LongRangeTower } from "../../game/sprites/towers/Towers";
import UIScene from "../../scenes/UIScene";

export type TowerType = typeof BasicTower | typeof FastTower | typeof LongRangeTower;

export interface TowerTypeInfo {
  name: string;
  type: TowerType;
  color: number;
  icon: string;
}

export class TowerSelection {
  private scene: Phaser.Scene;
  private dropdownButton?: Phaser.GameObjects.Rectangle;
  private dropdownButtonText?: Phaser.GameObjects.Text;
  private dropdownMenu?: Phaser.GameObjects.Container;
  private menuItems: Array<{
    rect: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Sprite | Phaser.GameObjects.Polygon;
    nameText: Phaser.GameObjects.Text;
    costText: Phaser.GameObjects.Text;
    towerInfo: TowerTypeInfo;
    worldY: number;
  }> = [];
  private isDropdownOpen: boolean = false;
  private selectedTowerType: TowerType | null = null;
  private onTowerSelected?: (towerType: TowerType | null) => void;
  private getTowerCost?: (towerType: TowerType) => number;
  private getTowerLimit?: (towerType: TowerType) => number;
  private getTowerCount?: (towerType: TowerType) => number;
  private isTowerAtLimit?: (towerType: TowerType) => boolean;

  // Available tower types
  private towerTypes: TowerTypeInfo[] = [
    { name: "Basic", type: BasicTower, color: BasicTower.COLOR, icon: "●" },
    { name: "Fast", type: FastTower, color: FastTower.COLOR, icon: "▲" },
    { name: "Long", type: LongRangeTower, color: LongRangeTower.COLOR, icon: "◆" },
    { name: "None", type: BasicTower, color: 0x888888, icon: "✕" } // Placeholder for 4th slot
  ];

  constructor(
    scene: Phaser.Scene, 
    onTowerSelected?: (towerType: TowerType | null) => void,
    getTowerCost?: (towerType: TowerType) => number,
    getTowerLimit?: (towerType: TowerType) => number,
    getTowerCount?: (towerType: TowerType) => number,
    isTowerAtLimit?: (towerType: TowerType) => boolean
  ) {
    this.scene = scene;
    this.onTowerSelected = onTowerSelected;
    this.getTowerCost = getTowerCost;
    this.getTowerLimit = getTowerLimit;
    this.getTowerCount = getTowerCount;
    this.isTowerAtLimit = isTowerAtLimit;
    this.createDropdownButton();
  }

  private createDropdownButton() {
    try {
      // Position button on right side, 3 tiles down from top, one tile to the left
      const buttonX = (GRID_COLS - 2) * TILE_SIZE + TILE_SIZE / 2;
      const buttonY = 3 * TILE_SIZE + TILE_SIZE / 2;
      
      console.log(`Creating dropdown button at (${buttonX}, ${buttonY}), GRID_COLS: ${GRID_COLS}, TILE_SIZE: ${TILE_SIZE}`);
      
      // Create button rectangle
      this.dropdownButton = this.scene.add.rectangle(buttonX, buttonY, TILE_SIZE * 0.9, TILE_SIZE * 0.9, 0x888888, 1);
      this.dropdownButton.setStrokeStyle(2, 0xffffff, 1);
      this.dropdownButton.setDepth(2000);
      this.dropdownButton.setInteractive({ useHandCursor: true });
      this.dropdownButton.setVisible(true);
      
      // Add text to button
      this.dropdownButtonText = this.scene.add.text(buttonX, buttonY, "▼", {
        fontSize: "20px",
        color: "#ffffff"
      });
      this.dropdownButtonText.setOrigin(0.5, 0.5);
      this.dropdownButtonText.setDepth(2001);
      this.dropdownButtonText.setVisible(true);
      
      console.log("Dropdown button created successfully");
    } catch (error) {
      console.error("Error creating dropdown button:", error);
    }
  }

  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  private openDropdown() {
    if (!this.dropdownButton || this.isDropdownOpen) return;
    
    this.isDropdownOpen = true;
    const buttonX = (GRID_COLS - 2) * TILE_SIZE + TILE_SIZE / 2;
    const buttonY = 3 * TILE_SIZE + TILE_SIZE / 2;
    
    // Menu tile size - 20% bigger than game tiles
    const menuTileSize = TILE_SIZE * 1.2;
    const menuStartY = buttonY + TILE_SIZE;
    
    // Clear previous menu items
    this.menuItems = [];
    
    // Create menu tiles for each tower type - each as separate game objects above game scene
    for (let i = 0; i < this.towerTypes.length; i++) {
      const towerInfo = this.towerTypes[i];
      const itemY = menuStartY + (i * menuTileSize);
      const isNone = towerInfo.name === "None";
      
      // Create menu item background - separate rectangle, not in container (more muted colors)
      // Darken the color by reducing brightness - multiply RGB values by 0.6 to darken
      // Extract RGB components using bitwise operations
      const r = Math.floor(((towerInfo.color >> 16) & 0xFF) * 0.6);
      const g = Math.floor(((towerInfo.color >> 8) & 0xFF) * 0.6);
      const b = Math.floor((towerInfo.color & 0xFF) * 0.6);
      const mutedColor = Phaser.Display.Color.GetColor(r, g, b);
      const menuItem = this.scene.add.rectangle(buttonX, itemY, menuTileSize * 0.9, menuTileSize * 0.9, mutedColor, 0.6);
      menuItem.setStrokeStyle(2, 0x666666, 0.7); // More muted stroke
      menuItem.setInteractive({ useHandCursor: true });
      menuItem.setDepth(3000); // Above game tiles (which are at 600)
      menuItem.setVisible(!isNone); // Hide "None" tile
      
      // Add tower icon (sprite or hexagon preview) - positioned to the left, outside the tile (bigger)
      const iconSize = menuTileSize * 0.7; // Increased from 0.4 to 0.7
      const iconX = buttonX - menuTileSize * 0.6; // Position to the left of the tile
      const icon = this.createTowerIcon(iconX, itemY, iconSize, towerInfo);
      icon.setDepth(3001);
      icon.setVisible(!isNone); // Hide icon for "None" tile
      
      // Add tower name
      const nameText = this.scene.add.text(buttonX, itemY - menuTileSize * 0.25, towerInfo.name, {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold"
      });
      nameText.setOrigin(0.5, 0.5);
      nameText.setDepth(3001);
      nameText.setVisible(!isNone); // Hide name for "None" tile
      
      // Add tower cost (use dynamic cost if available)
      const cost = this.getTowerCost ? this.getTowerCost(towerInfo.type) : ((towerInfo.type as any).COST || 0);
      const limit = this.getTowerLimit ? this.getTowerLimit(towerInfo.type) : Infinity;
      const count = this.getTowerCount ? this.getTowerCount(towerInfo.type) : 0;
      const atLimit = this.isTowerAtLimit ? this.isTowerAtLimit(towerInfo.type) : false;
      
      // Show cost and limit info (brighter text)
      let costTextStr = `$${cost}`;
      if (limit < Infinity) {
        costTextStr += ` (${count}/${limit})`;
      }
      if (atLimit) {
        costTextStr += " [LIMIT]";
      }
      
      // Use brighter colors for cost text
      const costColor = atLimit ? "#ff8888" : "#ffff00"; // Yellow for normal, light red for limit
      const costText = this.scene.add.text(buttonX, itemY + menuTileSize * 0.25, costTextStr, {
        fontSize: "13px",
        color: costColor,
        fontStyle: "bold"
      });
      costText.setOrigin(0.5, 0.5);
      costText.setDepth(3001);
      costText.setVisible(!isNone); // Hide cost for "None" tile
      
      // Store menu item for click detection
      this.menuItems.push({
        rect: menuItem,
        icon: icon,
        nameText: nameText,
        costText: costText,
        towerInfo: towerInfo,
        worldY: itemY
      });
    }
  }

  private createTowerIcon(x: number, y: number, size: number, towerInfo: TowerTypeInfo): Phaser.GameObjects.Sprite | Phaser.GameObjects.Polygon {
    // Map tower types to sprite sheet frame numbers
    const frameMap: Record<string, number> = {
      "Basic": 0,  // Frame 0 = Basic Tower
      "Fast": 1,   // Frame 1 = Fast Tower
      "Long": 2    // Frame 2 = Long Range Tower
    };
    
    const frameNumber = frameMap[towerInfo.name];
    
    // Try to use sprite sheet if available, otherwise fall back to hexagon
    if (frameNumber !== undefined && this.scene.textures.exists("towers")) {
      const sprite = this.scene.add.sprite(x, y, "towers", frameNumber);
      sprite.setDisplaySize(size, size);
      sprite.setOrigin(0.5, 0.5);
      return sprite;
    } else {
      // Fall back to hexagon shape
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push(
          new Phaser.Geom.Point(
            size * Math.cos(angle),
            size * Math.sin(angle)
          )
        );
      }
      const polygon = this.scene.add.polygon(x, y, points, towerInfo.color, 1);
      polygon.setOrigin(0.5, 0.5);
      return polygon;
    }
  }

  closeDropdown() {
    // Destroy all menu items
    for (const item of this.menuItems) {
      item.rect.destroy();
      item.icon.destroy();
      item.nameText.destroy();
      item.costText.destroy();
    }
    this.menuItems = [];
    
    if (this.dropdownMenu) {
      this.dropdownMenu.destroy();
      this.dropdownMenu = undefined;
    }
    this.isDropdownOpen = false;
  }

  handleClick(x: number, y: number): boolean {
    // Check if clicking on dropdown button
    if (this.dropdownButton) {
      const buttonBounds = this.dropdownButton.getBounds();
      if (buttonBounds && Phaser.Geom.Rectangle.Contains(buttonBounds, x, y)) {
        this.toggleDropdown();
        return true;
      }
    }
    
    // Check if clicking on individual dropdown menu items
    if (this.isDropdownOpen) {
      for (const item of this.menuItems) {
        const itemBounds = item.rect.getBounds();
        if (itemBounds && Phaser.Geom.Rectangle.Contains(itemBounds, x, y)) {
          this.handleDropdownClick(item.towerInfo);
          return true;
        }
      }
    }
    
    return false;
  }

  private handleDropdownClick(towerInfo: TowerTypeInfo) {
    // Check if player can afford the tower
    const uiScene = this.scene.scene.get("UI") as UIScene;
    const towerCost = this.getTowerCost ? this.getTowerCost(towerInfo.type) : ((towerInfo.type as any).COST || 0);
    
    if (towerInfo.name === "None") {
      // Deselect tower
      this.selectedTowerType = null;
      if (this.onTowerSelected) {
        this.onTowerSelected(null as any);
      }
    } else {
      // Check if tower is at limit
      if (this.isTowerAtLimit && this.isTowerAtLimit(towerInfo.type)) {
        const limit = this.getTowerLimit ? this.getTowerLimit(towerInfo.type) : Infinity;
        console.log(`Cannot select tower - ${towerInfo.name} tower limit reached (${limit})`);
        this.closeDropdown();
        return;
      }
      
      if (uiScene.canAfford(towerCost)) {
        // Select tower type
        this.selectedTowerType = towerInfo.type;
        if (this.onTowerSelected) {
          this.onTowerSelected(towerInfo.type);
        }
        console.log(`Tower type selected: ${towerInfo.name}`);
      } else {
        console.log(`Cannot select tower - insufficient funds (need ${towerCost}, have ${uiScene.getMoney()})`);
      }
    }
    
    this.closeDropdown();
  }
  
  updateCosts() {
    // Update costs when dropdown is open
    if (this.isDropdownOpen) {
      // Close and reopen to refresh costs
      const wasOpen = this.isDropdownOpen;
      this.closeDropdown();
      if (wasOpen) {
        this.openDropdown();
      }
    }
  }

  getSelectedTowerType(): TowerType | null {
    return this.selectedTowerType;
  }

  clearSelection() {
    this.selectedTowerType = null;
  }

  getIsDropdownOpen(): boolean {
    return this.isDropdownOpen;
  }

  destroy() {
    this.closeDropdown();
    if (this.dropdownButton) {
      this.dropdownButton.destroy();
    }
    if (this.dropdownButtonText) {
      this.dropdownButtonText.destroy();
    }
  }
}
