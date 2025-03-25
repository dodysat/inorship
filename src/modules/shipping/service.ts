import { Shipping, ShippingItem, ShippingStatus } from "@prisma/client"
import { uid } from "../../helpers/utils"
import { ShippingRepository } from "./repository"
import { DtoOrder } from "../order/types"
import kafka from "../../config/kafka"

export class ShippingService {
  static async onOrderReadyForShipping(order: DtoOrder): Promise<void> {
    const shipping: Shipping = {
      id: uid(),
      orderId: order.id,
      status: ShippingStatus.PENDING,
    }
    const newShipping = await ShippingRepository.createShipping(shipping)

    const shippingItems: ShippingItem[] = order.items.map((item) => ({
      id: uid(),
      shippingId: newShipping.id,
      productId: item.productId,
      quantity: item.quantity,
    }))

    await ShippingRepository.createShippingItems(shippingItems)

    await kafka.producer().send({
      topic: "ShippingStatus",
      messages: [
        {
          key: newShipping.id,
          value: JSON.stringify(shipping),
        },
      ],
    })
  }

  static async updateShippingStatus(
    shippingId: string,
    status: ShippingStatus
  ): Promise<void> {
    const shippingData: Shipping | null =
      await ShippingRepository.getShippingById(shippingId)

    if (!shippingData) {
      throw new Error("Shipping not found")
    }

    await ShippingRepository.updateShippingStatus(shippingId, status)

    await kafka.producer().send({
      topic: "ShippingStatus",
      messages: [
        {
          key: shippingId,
          value: JSON.stringify(shippingData),
        },
      ],
    })
  }
}
