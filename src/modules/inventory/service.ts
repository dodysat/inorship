import kafka from "../../config/kafka"
import { DtoOrder, DtoOrderItemStatus } from "../order/types"
import { InventoryRepository } from "./repository"

export class InventoryService {
  static async onOrderPlaced(order: DtoOrder): Promise<void> {
    const productIds = order.items.map((item) => item.productId)
    const inventories = await InventoryRepository.getInventoryByProductIds(
      productIds
    )

    const itemsFulfil = order.items.map((item) => {
      const inventory = inventories.find(
        (inventory) => inventory.productId === item.productId
      )
      return inventory && inventory.quantity >= item.quantity
        ? {
            productId: item.productId,
            quantity: item.quantity,
          }
        : null
    })

    if (itemsFulfil !== null && itemsFulfil.length > 0) {
      for (const item of itemsFulfil) {
        if (item) {
          await InventoryRepository.reduceInventoryByProductId(
            item.productId,
            item.quantity
          )
        }
      }

      const fulfilledOrder: DtoOrder = {
        id: order.id,
        items: itemsFulfil
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            status: DtoOrderItemStatus.FULFILLED,
          })),
      }

      await kafka.producer().send({
        topic: "StockReserved",
        messages: [
          {
            key: order.id,
            value: JSON.stringify(fulfilledOrder),
          },
        ],
      })
    }

    const unfulfill = order.items.filter(
      (item) =>
        !itemsFulfil
          .filter(
            (fulfilled): fulfilled is NonNullable<typeof fulfilled> =>
              fulfilled !== null
          )
          .find((fulfilled) => fulfilled.productId === item.productId)
    )

    if (unfulfill.length > 0) {
      const unfulfilledOrder: DtoOrder = {
        id: order.id,
        items: unfulfill.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          status: DtoOrderItemStatus.UNFULFILLED,
        })),
      }

      await kafka.producer().send({
        topic: "OutOfStock",
        messages: [
          {
            key: order.id,
            value: JSON.stringify(unfulfilledOrder),
          },
        ],
      })
    }
  }
}
