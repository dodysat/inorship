import { Order, OrderItem } from "@prisma/client"
import kafka from "../../config/kafka"
import { uid } from "../../helpers/utils"
import { OrderRepository } from "./repository"
import { DtoOrder, DtoOrderItem, DtoOrderItemStatus } from "./types"

export class OrderService {
  static async createOrder(order: DtoOrderItem[]): Promise<DtoOrder> {
    if (order.length === 0) {
      throw new Error("Order must have at least one item")
    }

    const orderData: Order = {
      id: uid(),
    }

    const orderCreated = await OrderRepository.createOrder(orderData)

    const orderItemData: OrderItem[] = order.map((item) => {
      return {
        id: uid(),
        orderId: orderCreated.id,
        productId: item.productId,
        quantity: item.quantity,
        status: DtoOrderItemStatus.UNFULFILLED,
      }
    })

    const orderItemCreated = await OrderRepository.createOrderItems(
      orderItemData
    )

    const newOrderData: DtoOrder = {
      id: orderCreated.id,
      items: orderItemCreated.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        status: item.status as DtoOrderItemStatus,
      })),
    }

    await kafka.producer().send({
      topic: "OrderPlaced",
      messages: [
        {
          key: orderCreated.id,
          value: JSON.stringify(newOrderData),
        },
      ],
    })

    return newOrderData
  }

  static async onStockReserved(order: DtoOrder): Promise<void> {
    const productIds = order.items.map((item) => item.productId)
    const orderItems =
      await OrderRepository.getOrderItemsByOrderIdAndProductIds(
        order.id,
        productIds
      )

    order.items.forEach(async (item) => {
      const orderItem = orderItems.find(
        (orderItem) => orderItem.productId === item.productId
      )

      if (!orderItem) {
        throw new Error("Order item not found")
      }

      await OrderRepository.updateOrderItemStatus(
        order.id,
        item.productId,
        DtoOrderItemStatus.FULFILLED
      )
    })

    await kafka.producer().send({
      topic: "OrderReadyForShipping",
      messages: [
        {
          key: order.id,
          value: JSON.stringify(order),
        },
      ],
    })
  }
}
