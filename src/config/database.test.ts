import prismaClient from "./database"

describe("prismaClient", () => {
  it("should be defined", () => {
    expect(prismaClient).toBeDefined()
  })
})
