import Phaser from "phaser";
import { GRID_COLS, TILE_SIZE } from "../../game/data/demoMap";
import { BasicTower, FastTower, LongRangeTower } from "../../game/sprites/towers/Towers";
import type { BaseTower } from "../../game/sprites/towers/BaseTower";
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
    icon: Phaser.GameObjects.Polygon;
    nameText: Phaser.GameObjects.Text;
    costText: Phaser.GameObjects.Text;
    towerInfo: TowerTypeInfo;
    worldY: number;
  }> = [];
  private isDropdownOpen: boolean = false;
  private selectedTowerType: TowerType | null = null;
  private onTowerSelected?: (towerType: TowerType | null) => void;

  // Available tower types
  private towerTypes: TowerTypeInfo[] = [
    { name: "Basic", type: BasicTower, color: BasicTower.COLOR, icon: "●" },
    { name: "Fast", type: FastTower, color: FastTower.COLOR, icon: "▲" },
    { name: "Long", type: LongRangeTower, color: LongRangeTower.COLOR, icon: "◆" },
    { name: "None", type: BasicTower, color: 0x888888, icon: "✕" } // Placeholder for 4th slot
  ];

  constructor(scene: Phaser.Scene, onTowerSelected?: (towerType: TowerType | null) => void) {
    this.scene = scene;
    this.onTowerSelected = onTowerSelected;
    this.createDropdownButton();
  }

  private createDropdownButton() {
    try {
      // Position button on right side, 3 tiles down from top
      const buttonX = (GRID_COLS - 1) * TILE_SIZE + TILE_SIZE / 2;
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
    const buttonX = (GRID_COLS - 1) * TILE_SIZE + TILE_SIZE / 2;
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
      
      // Create menu item background - separate rectangle, not in container
      const menuItem = this.scene.add.rectangle(buttonX, itemY, menuTileSize * 0.9, menuTileSize * 0.9, towerInfo.color, 0.9);
      menuItem.setStrokeStyle(3, 0xffffff, 1);
      menuItem.setInteractive({ useHandCursor: true });
      menuItem.setDepth(3000); // Above game tiles (which are at 600)
      menuItem.setVisible(true);
      
      // Add tower icon (hexagon preview)
      const iconSize = menuTileSize * 0.4;
      const icon = this.createTowerIcon(buttonX, itemY, iconSize, towerInfo.color);
      icon.setDepth(3001);
      icon.setVisible(true);
      
      // Add tower name
      const nameText = this.scene.add.text(buttonX, itemY - menuTileSize * 0.25, towerInfo.name, {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold"
      });
      nameText.setOrigin(0.5, 0.5);
      nameText.setDepth(3001);
      nameText.setVisible(true);
      
      // Add tower cost
      const cost = (towerInfo.type as any).COST || 0;
      const costText = this.scene.add.text(buttonX, itemY + menuTileSize * 0.25, `$${cost}`, {
        fontSize: "12px",
        color: "#ffffff"
      });
      costText.setOrigin(0.5, 0.5);
      costText.setDepth(3001);
      costText.setVisible(true);
      
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

  private createTowerIcon(x: number, y: number, size: number, color: number): Phaser.GameObjects.Polygon {
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
    const polygon = this.scene.add.polygon(x, y, points, color, 1);
    polygon.setOrigin(0.5, 0.5);
    return polygon;
  }

  private closeDropdown() {
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
    const towerCost = (towerInfo.type as any).COST || 0;
    
    if (towerInfo.name === "None") {
      // Deselect tower
      this.selectedTowerType = null;
      if (this.onTowerSelected) {
        this.onTowerSelected(null as any);
      }
    } else if (uiScene.canAfford(towerCost)) {
      // Select tower type
      this.selectedTowerType = towerInfo.type;
      if (this.onTowerSelected) {
        this.onTowerSelected(towerInfo.type);
      }
      console.log(`Tower type selected: ${towerInfo.name}`);
    } else {
      console.log(`Cannot select tower - insufficient funds (need ${towerCost}, have ${uiScene.getMoney()})`);
    }
    
    this.closeDropdown();
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
