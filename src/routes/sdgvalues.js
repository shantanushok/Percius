
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import gql from "graphql-tag";
import pool from "../config/db.js";

export async function createGraphQLMiddleware() {
  console.log("🚀 Initializing GraphQL Middleware...");

  const typeDefs = gql`
    type IndicatorValue {
      sdg_goal: Int
      sdg_name: String
      state: String
      indicator_name: String
      indicator_value: Float
      year: Int
      source_url: String
      data_source: String
      inverse_scale: Boolean
    }

    type IndicatorMeta {
      id: ID
      sdg_goal: Int
      sdg_name: String
      indicator_name: String
      inverse_scale: Boolean
    }

    type Query {
      indicatorValues(
        sdg_goal: Int
        sdg_name: String
        indicator_name: String
        state: String
        year: Int
      ): [IndicatorValue]

      sdgIndicators(sdg_goal: Int, sdg_name: String): [IndicatorMeta]
      indicatorInfo(indicator_name: String!): IndicatorMeta
    }
  `;

  const resolvers = {
    Query: {
      // ✅ Fetch indicator values joined with inverse scale flag
      indicatorValues: async (_, args) => {
        try {
          console.log("🔍 Fetching indicator values with filters:", args);

          const filters = [];
          const values = [];
          let idx = 1;

          for (const [key, val] of Object.entries(args)) {
            if (val !== undefined && val !== null) {
              filters.push(`sd.${key} = $${idx++}`);
              values.push(val);
            }
          }

          const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

          const query = `
            SELECT 
              sd.sdg_goal,
              sd.sdg_name,
              sd.state,
              sd.indicator_name,
              sd.indicator_value,
              sd.year,
              sd.source_url,
              sd.data_source,
              si.inverse_scale
            FROM sdg_data sd
            LEFT JOIN sdg_indicators si
              ON sd.indicator_name = si.indicator_name
              AND sd.sdg_goal = si.sdg_goal
            ${whereClause};
          `;

          const { rows } = await pool.query(query, values);
          console.log(`✅ Retrieved ${rows.length} rows (joined with indicator metadata)`);
          return rows;
        } catch (err) {
          console.error("❌ Error fetching indicator values:", err.message);
          throw new Error("Database query failed");
        }
      },

      // ✅ Fetch list of indicators per SDG
      sdgIndicators: async (_, args) => {
        try {
          console.log("🔍 Fetching indicators metadata with filters:", args);
          const filters = [];
          const values = [];
          let idx = 1;

          for (const [key, val] of Object.entries(args)) {
            if (val !== undefined && val !== null) {
              filters.push(`${key} = $${idx++}`);
              values.push(val);
            }
          }

          const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
          const query = `
            SELECT id, sdg_goal, sdg_name, indicator_name, inverse_scale
            FROM sdg_indicators
            ${whereClause}
            ORDER BY sdg_goal, id;
          `;

          const { rows } = await pool.query(query, values);
          console.log(`✅ Retrieved ${rows.length} indicators from sdg_indicators`);
          return rows;
        } catch (err) {
          console.error("❌ Error fetching indicators metadata:", err.message);
          throw new Error("Database query failed");
        }
      },

      // ✅ Fetch one indicator’s metadata
      indicatorInfo: async (_, { indicator_name }) => {
        try {
          console.log(`🔍 Fetching info for indicator: ${indicator_name}`);
          const query = `
            SELECT id, sdg_goal, sdg_name, indicator_name, inverse_scale
            FROM sdg_indicators
            WHERE indicator_name = $1
            LIMIT 1;
          `;
          const { rows } = await pool.query(query, [indicator_name]);
          if (rows.length === 0) {
            console.warn(`⚠️ No indicator found for: ${indicator_name}`);
            return null;
          }
          return rows[0];
        } catch (err) {
          console.error("❌ Error fetching indicator info:", err.message);
          throw new Error("Database query failed");
        }
      },
    },
  };

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  console.log("✅ Apollo GraphQL Server started successfully.");
  return expressMiddleware(server);
}
