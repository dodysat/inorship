import { ShippingService } from "./service"
import kafka from "../../config/kafka"
import { ShippingRepository } from "./repository"
import { ShippingStatus } from "@prisma/client"
import { DtoOrder, DtoOrderItemStatus } from "../order/types"

jest.mock("./repository")
jest.mock("../../config/kafka")
jest.mock("../../helpers/utils", () => ({
  uid: jest.fn().mockReturnValue("MOCKED_ID"),
}))

describe("ShippingService", () => {
  let kafkaProducerMock: { send: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()

    kafkaProducerMock = { send: jest.fn().mockResolvedValue(null) }
    ;(kafka.producer as jest.Mock).mockReturnValue(kafkaProducerMock)
  })

  describe("onOrderReadyForShipping", () => {
    const mockOrder: DtoOrder = {
      id: "ORDER_123",
      items: [
        {
          productId: "PROD_1",
          quantity: 2,
          status: DtoOrderItemStatus.FULFILLED,
        },
        {
          productId: "PROD_2",
          quantity: 3,
          status: DtoOrderItemStatus.FULFILLED,
        },
      ],
    }

    it("should create shipping record and items, then send Kafka event", async () => {
      const mockShipping = {
        id: "MOCKED_ID",
        orderId: "ORDER_123",
        status: ShippingStatus.PENDING,
      }

      ;(ShippingRepository.createShipping as jest.Mock).mockResolvedValue(
        mockShipping
      )
      ;(ShippingRepository.createShippingItems as jest.Mock).mockResolvedValue(
        null
      )

      await ShippingService.onOrderReadyForShipping(mockOrder)

      // Verify shipping creation
      expect(ShippingRepository.createShipping).toHaveBeenCalledWith({
        id: "MOCKED_ID",
        orderId: "ORDER_123",
        status: ShippingStatus.PENDING,
      })

      // Verify shipping items creation
      expect(ShippingRepository.createShippingItems).toHaveBeenCalledWith([
        {
          id: "MOCKED_ID",
          shippingId: "MOCKED_ID",
          productId: "PROD_1",
          quantity: 2,
        },
        {
          id: "MOCKED_ID",
          shippingId: "MOCKED_ID",
          productId: "PROD_2",
          quantity: 3,
        },
      ])

      // Verify Kafka event
      expect(kafkaProducerMock.send).toHaveBeenCalledWith({
        topic: "ShippingStatus",
        messages: [
          {
            key: "MOCKED_ID",
            value: JSON.stringify(mockShipping),
          },
        ],
      })
    })
  })

  describe("updateShippingStatus", () => {
    const shippingId = "SHIP_123"
    const newStatus = ShippingStatus.DELIVERED

    it("should update status and send Kafka event when shipping exists", async () => {
      const mockShipping = {
        id: shippingId,
        orderId: "ORDER_123",
        status: ShippingStatus.PENDING,
      }

      ;(ShippingRepository.getShippingById as jest.Mock).mockResolvedValue(
        mockShipping
      )
      ;(ShippingRepository.updateShippingStatus as jest.Mock).mockResolvedValue(
        null
      )

      await ShippingService.updateShippingStatus(shippingId, newStatus)

      // Verify status update
      expect(ShippingRepository.updateShippingStatus).toHaveBeenCalledWith(
        shippingId,
        newStatus
      )

      // Verify Kafka event
      expect(kafkaProducerMock.send).toHaveBeenCalledWith({
        topic: "ShippingStatus",
        messages: [
          {
            key: shippingId,
            value: JSON.stringify(mockShipping),
          },
        ],
      })
    })

    it("should throw error when shipping not found", async () => {
      ;(ShippingRepository.getShippingById as jest.Mock).mockResolvedValue(null)

      await expect(
        ShippingService.updateShippingStatus(shippingId, newStatus)
      ).rejects.toThrow("Shipping not found")

      expect(ShippingRepository.updateShippingStatus).not.toHaveBeenCalled()
      expect(kafkaProducerMock.send).not.toHaveBeenCalled()
    })
  })
})
