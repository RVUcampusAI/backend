const supabase = require('../config/supabase');

async function fixStudentNulls() {
  console.log('--- Fixing NULL program_id and batch_id in Students ---');
  
  // From previous check:
  // Programs: [ { id: 4, name: 'Cybersecurity' }, { id: 3, name: 'Bachelor of Computer Application' }, { id: 2, name: 'B.Sc Data Science' }, { id: 1, name: 'B.Tech CSE' } ]
  // Batches: [ { id: 2, year: 2023 }, { id: 3, year: 2024 }, { id: 4, year: 2025 }, { id: 1, year: 2022 } ]
  
  const programIds = [1, 2, 3, 4];
  const batchIds = [1, 2, 3, 4];

  const { data: students, error } = await supabase
    .from('student')
    .select('id, name')
    .or('program_id.is.null,batch_id.is.null');

  if (error) {
    console.error('Error fetching students:', error);
    return;
  }

  console.log(`Found ${students.length} students with NULL fields.`);

  for (const s of students) {
    const randomProgram = programIds[Math.floor(Math.random() * programIds.length)];
    const randomBatch = batchIds[Math.floor(Math.random() * batchIds.length)];
    
    console.log(`Updating student ${s.id} (${s.name}): Program -> ${randomProgram}, Batch -> ${randomBatch}`);
    
    const { error: updateError } = await supabase
      .from('student')
      .update({
        program_id: randomProgram,
        batch_id: randomBatch
      })
      .eq('id', s.id);

    if (updateError) {
      console.error(`Error updating student ${s.id}:`, updateError);
    }
  }
}

fixStudentNulls().then(() => console.log('--- Done ---'));
