import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim:true
    },
    description: {
      type: String
    },
    budget: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["pending", "approved", "in_progress", "finished", "cancelled"],
      default: 'pending'
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    startDate: {
        type: Date
    },
    
    endDate: {
        type: Date
    },

  },
  { timestamps: true }
)

export default mongoose.model('Project', projectSchema)




// import mongoose from "mongoose"

// const projectSchema = new mongoose.Schema(
//     {
//         title: {
//             type: String,
//             required: true,
//             trim: true
//         },
    
//         description: {
//             type: String
//         },
    
//         status: {
//             type: String,
//             enum: ["pending", "approved", "in_progress", "finished", "cancelled"],
//             default: "pending"
//         },
    
//         budget: {
//             type: Number,
//             min: 0
//         },
    
//         startDate: {
//             type: Date
//         },
    
//         endDate: {
//             type: Date
//         },
    
//         client: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "Client",
//             required: true
//         },
    
//         owner: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User",
//             required: true
//         }
//     },
//     {
//         timestamps: true
//     }
// )

// const Project = mongoose.model("Project", projectSchema)
// export default Project;