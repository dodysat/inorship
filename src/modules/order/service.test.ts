import { uid } from "../../helpers/utils"
import { OrderService } from "./service"

import kafka from "../../config/kafka"

jest.mock("../../config/kafka")

describe("OrderService", () => {
  const mockProducerSend = jest.fn().mockResolvedValue([{}]) // Mock Kafka send response

  beforeEach(() => {
    jest.clearAllMocks()
    ;(kafka.producer as jest.Mock).mockReturnValue({
      send: mockProducerSend,
    })
  })

  it("should create an order", async () => {
    const order = await OrderService.createOrder([
      {
        productId: uid(),
        quantity: 2,
      },
    ])

    expect(order.id).toBeDefined()
    expect(order.items).toHaveLength(1)
  })

  it("should create multiple orders", async () => {
    const order = await OrderService.createOrder([
      {
        productId: uid(),
        quantity: 2,
      },
      {
        productId: uid(),
        quantity: 3,
      },
    ])

    expect(order.id).toBeDefined()
    expect(order.items).toHaveLength(2)
  })
})
