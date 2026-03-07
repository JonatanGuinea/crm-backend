import mongoose from "mongoose"

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email inválido"]
    },

    phone: {
      type: String,
      trim: true
    },

    company: {
      type: String,
      trim: true
    },

    notes: {
      type: String,
      trim: true
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
)

clientSchema.index({ organization: 1, createdAt: -1 })
clientSchema.index({ organization: 1, name: 1 })


export default mongoose.model("Client", clientSchema)