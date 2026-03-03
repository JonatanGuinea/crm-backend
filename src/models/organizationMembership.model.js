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
      default: 'member'
    }
  },
  { timestamps: true }
)

// Evita duplicados
membershipSchema.index({ user: 1, organization: 1 }, { unique: true })

export default mongoose.model('OrganizationMembership', membershipSchema)