/**
 * Project: School E-Voting System
 * Developer: Hassan Iftikhar
 * Date: May 2025
 * Description: Backend & Frontend developed by Hassan Iftikhar.
 * Website: https://hassaniftikhar.vercel.app/
 * Github: https://github.com/hassan-iftikhar00/e-voting-pekiseniorhighschool
 * LinkedIn: https://www.linkedin.com/in/hassaniftikhar0/
 * Fiverr: https://www.fiverr.com/pasha_hassan?public_mode=true
 * Email: hassaniftikhardev@gmail.com
 * Note: Redistribution or commercial use without license is not allowed.
 */

import mongoose from "mongoose";
const { Schema } = mongoose;

const voteSchema = new Schema(
  {
    voter: {
      type: Schema.Types.ObjectId,
      ref: "Voter",
      required: true,
    },
    election: {
      type: Schema.Types.ObjectId,
      ref: "Election",
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    positionId: {
      type: Schema.Types.ObjectId,
      ref: "Position",
    },
    candidate: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      // Not required for abstention votes
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isAbstention: {
      type: Boolean,
      default: false,
    },
    // Add this field to track separate voting sessions from the same voter
    votingSession: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Replace with simpler indexes without uniqueness
voteSchema.index({ voter: 1, election: 1 });
voteSchema.index({ election: 1, position: 1 });
voteSchema.index({ isAbstention: 1 });
voteSchema.index({ votingSession: 1 });

// // Use this function to run on server start to drop the problematic index
// export const dropVoteUniqueIndex = async () => {
//   try {
//     // Check if collection exists
//     const collections = await mongoose.connection.db
//       .listCollections({ name: "votes" })
//       .toArray();
//     if (collections.length > 0) {
//       console.log("Attempting to drop problematic index on votes collection");
//       try {
//         await mongoose.connection.db
//           .collection("votes")
//           .dropIndex("voter_1_election_1_position_1");
//         console.log("Successfully dropped problematic index");
//       } catch (err) {
//         // Try dropping just the voter_1_position_1 index if that's what exists
//         try {
//           await mongoose.connection.db
//             .collection("votes")
//             .dropIndex("voter_1_position_1");
//           console.log("Successfully dropped voter_1_position_1 index");
//         } catch (innerErr) {
//           console.log("Index drop error (might not exist):", innerErr.message);
//         }
//       }
//     }
//   } catch (error) {
//     console.log("Collection check error:", error.message);
//   }
// };

const VoteModel = mongoose.model("Vote", voteSchema);
export default VoteModel;
