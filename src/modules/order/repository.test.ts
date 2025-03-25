import { OrderRepository } from "./repository"
import prismaClient from "../../config/database"
import { Order, OrderItem, OrderItemStatus } from "@prisma/client"
import { Prisma } from "@prisma/client"

// Properly mock Prisma client with nested order and orderItem models
jest.mock("../../config/database", () => ({
  __esModule: true,
  default: {
    order: {
      create: jest.fn(),
    },
    orderItem: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

describe("OrderRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createOrder", () => {
    it("should create an order using Prisma and return the result", async () => {
      const mockOrder: Order = {
        id: "ORDER_123",
      }

      // Mock the Prisma order.create method
      ;(prismaClient.order.create as jest.Mock).mockResolvedValue(mockOrder)

      const orderData: Order = { id: "ORDER_123" } as Order
      const result = await OrderRepository.createOrder(orderData)

      expect(prismaClient.order.create).toHaveBeenCalledWith({
        data: orderData,
      })
      expect(result).toEqual(mockOrder)
    })
  })

  describe("createOrderItems", () => {
    it("should create order items and fetch them by orderId", async () => {
      const mockOrderItemsInput: Prisma.OrderItemCreateManyInput[] = [
        {
          orderId: "ORDER_123",
          productId: "PRODUCT_456",
          quantity: 2,
          status: "UNFULFILLED",
        },
        {
          orderId: "ORDER_123",
          productId: "PRODUCT_789",
          quantity: 3,
          status: "UNFULFILLED",
        },
      ]

      const mockCreatedItems: OrderItem[] = [
        {
          id: "ITEM_1",
          ...mockOrderItemsInput[0],
        },
        {
          id: "ITEM_2",
          ...mockOrderItemsInput[1],
        },
      ]

      ;(prismaClient.orderItem.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      })
      ;(prismaClient.orderItem.findMany as jest.Mock).mockResolvedValue(
        mockCreatedItems
      )

      const result = await OrderRepository.createOrderItems(mockOrderItemsInput)

      // Verify Prisma calls
      expect(prismaClient.orderItem.createMany).toHaveBeenCalledWith({
        data: mockOrderItemsInput,
      })
      expect(prismaClient.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: "ORDER_123" },
      })
      expect(result).toEqual(mockCreatedItems)
    })
  })

  // getOrderItemsByOrderIdAndProductIds
  describe("getOrderItemsByOrderIdAndProductIds", () => {
    it("should fetch order items by orderId and productIds", async () => {
      const mockOrderId = "ORDER_123"
      const mockProductIds = ["PRODUCT_456", "PRODUCT_789"] // Array of productIds

      const mockOrderItems: OrderItem[] = [
        {
          id: "ITEM_1",
          orderId: mockOrderId,
          productId: "PRODUCT_456",
          quantity: 2,
          status: "UNFULFILLED",
        },
        {
          id: "ITEM_2",
          orderId: mockOrderId,
          productId: "PRODUCT_789",
          quantity: 3,
          status: "UNFULFILLED",
        },
      ]

      ;(prismaClient.orderItem.findMany as jest.Mock).mockResolvedValue(
        mockOrderItems
      )

      const result = await OrderRepository.getOrderItemsByOrderIdAndProductIds(
        mockOrderId,
        mockProductIds
      )

      // Verify Prisma call
      expect(prismaClient.orderItem.findMany).toHaveBeenCalledWith({
        where: {
          orderId: mockOrderId,
          productId: {
            in: mockProductIds,
          },
        },
      })
      expect(result).toEqual(mockOrderItems)
    })
  })

  // updateOrderItemStatus
  describe("updateOrderItemStatus", () => {
    it("should update order item status by orderId and productId", async () => {
      const mockOrderId = "ORDER_123"
      const mockProductId = "PRODUCT_456"
      const mockStatus = OrderItemStatus.FULFILLED

      ;(prismaClient.orderItem.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      })

      await OrderRepository.updateOrderItemStatus(
        mockOrderId,
        mockProductId,
        mockStatus
      )

      // Verify Prisma call
      expect(prismaClient.orderItem.updateMany).toHaveBeenCalledWith({
        where: {
          orderId: mockOrderId,
          productId: mockProductId,
        },
        data: {
          status: mockStatus,
        }, // Update status to FULFILLED
      })
    })
  })
})
