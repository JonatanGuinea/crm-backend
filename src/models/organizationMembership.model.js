import mongoose from 'mongoose'

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'disabled'],
      default: 'active'
    }
  },
  { timestamps: true }
)

// Evita duplicados
membershipSchema.index({ user: 1, organization: 1 }, { unique: true })
membershipSchema.index({ user: 1 })
membershipSchema.index({ organization: 1 })

export default mongoose.model('OrganizationMembership', membershipSchema)