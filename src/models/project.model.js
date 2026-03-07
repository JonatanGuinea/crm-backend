import mongoose from "mongoose"

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true
    },

    budget: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ["pending", "approved", "in_progress", "finished", "cancelled"],
      default: "pending",
      index: true
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
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
    },

    startDate: {
      type: Date
    },

    endDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)


// Índices compuestos (MUY importantes para SaaS multi-tenant)

projectSchema.index({ organization: 1, createdAt: -1 })
projectSchema.index({ organization: 1, status: 1 })
projectSchema.index({ organization: 1, client: 1 })

export default mongoose.model("Project", projectSchema)