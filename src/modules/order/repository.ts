import { Prisma, Order, OrderItem, OrderItemStatus } from "@prisma/client"
import prismaClient from "../../config/database"

export class OrderRepository {
  static async createOrder(order: Order): Promise<Order> {
    return await prismaClient.order.create({ data: order })
  }

  static async createOrderItems(
    orderItems: Prisma.OrderItemCreateManyInput[]
  ): Promise<OrderItem[]> {
    await prismaClient.orderItem.createMany({ data: orderItems })

    const orderItemCreated = await prismaClient.orderItem.findMany({
      where: {
        orderId: orderItems[0].orderId,
      },
    })

    return orderItemCreated
  }

  static async getOrderItemsByOrderIdAndProductIds(
    orderId: string,
    productIds: string[]
  ): Promise<OrderItem[]> {
    return await prismaClient.orderItem.findMany({
      where: {
        orderId,
        productId: {
          in: productIds,
        },
      },
    })
  }

  static async updateOrderItemStatus(
    orderId: string,
    productId: string,
    status: OrderItemStatus
  ): Promise<void> {
    await prismaClient.orderItem.updateMany({
      where: {
        orderId,
        productId,
      },
      data: {
        status,
      },
    })
  }
}
