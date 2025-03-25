import { Shipping, ShippingItem, ShippingStatus } from "@prisma/client"
import prismaClient from "../../config/database"

export class ShippingRepository {
  static async createShipping(shipping: Shipping): Promise<Shipping> {
    return await prismaClient.shipping.create({ data: shipping })
  }

  static async createShippingItems(
    shippingItems: ShippingItem[]
  ): Promise<void> {
    await prismaClient.shippingItem.createMany({
      data: shippingItems,
    })
  }

  static async updateShippingStatus(
    shippingId: string,
    status: ShippingStatus
  ): Promise<void> {
    await prismaClient.shipping.update({
      where: { id: shippingId },
      data: { status },
    })
  }

  static async getShippingById(id: string): Promise<Shipping | null> {
    return await prismaClient.shipping.findUnique({ where: { id } })
  }
}
