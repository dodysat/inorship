import { Inventory } from "@prisma/client"
import prismaClient from "../../config/database"

export class InventoryRepository {
  static async getInventoryByProductIds(
    productIds: string[]
  ): Promise<Inventory[]> {
    return await prismaClient.inventory.findMany({
      where: {
        productId: {
          in: productIds,
        },
      },
    })
  }

  static async reduceInventoryByProductId(
    productId: string,
    quantity: number
  ): Promise<Inventory> {
    return await prismaClient.inventory.update({
      where: {
        id: productId,
      },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    })
  }
}
