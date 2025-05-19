const knex = require('knex');
const path = require('path');
const dbPath = path.join(__dirname, 'db', 'infini.sqlite3');

// Create knex instance
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: dbPath
  },
  useNullAsDefault: true
});

async function createTable() {
  try {
    // Check if table exists
    const exists = await db.schema.hasTable('infini_batch_transfer_histories');
    if (exists) {
      console.log('Table already exists');
      return;
    }
    
    // Create the table directly
    await db.schema.createTable('infini_batch_transfer_histories', table => {
      table.increments('id').primary();
      table.integer('batch_id').unsigned().notNullable();
      table.integer('relation_id').unsigned().nullable();
      table.string('status', 20).notNullable();
      table.string('message', 500).nullable();
      table.text('details').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now()).notNullable();
    });
    
    // Create indexes
    await db.raw('CREATE INDEX idx_infini_batch_transfer_histories_batch_id ON infini_batch_transfer_histories (batch_id)');
    await db.raw('CREATE INDEX idx_infini_batch_transfer_histories_relation_id ON infini_batch_transfer_histories (relation_id)');
    await db.raw('CREATE INDEX idx_infini_batch_transfer_histories_status ON infini_batch_transfer_histories (status)');
    await db.raw('CREATE INDEX idx_infini_batch_transfer_histories_created_at ON infini_batch_transfer_histories (created_at)');
    
    console.log('Table infini_batch_transfer_histories created successfully');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await db.destroy();
  }
}

// Execute the function
createTable();
