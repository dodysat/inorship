export interface DtoOrderItem {
  productId: string
  quantity: number
  status?: DtoOrderItemStatus
}

export enum DtoOrderItemStatus {
  FULFILLED = "FULFILLED",
  UNFULFILLED = "UNFULFILLED",
}

export interface DtoOrder {
  id: string
  items: DtoOrderItem[]
}
