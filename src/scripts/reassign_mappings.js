const supabase = require('../config/supabase');

async function reassignMappings() {
  console.log('--- Reassigning Mappings to @rvu.edu.in Records ---');
  
  // Mappings from @rvce.edu.in records (IDs 101-110)
  // Counterparts with @rvu.edu.in records (IDs 11-20)
  const mappingPairs = [
    { oldId: 101, newId: 11 },
    { oldId: 102, newId: 12 },
    { oldOld: 103, newId: 13 },
    { oldId: 104, newId: 14 },
    { oldId: 105, newId: 15 },
    { oldId: 106, newId: 16 },
    { oldId: 107, newId: 17 },
    { oldId: 108, newId: 18 },
    { oldId: 109, newId: 19 },
    { oldId: 110, newId: 20 }
  ];
  
  for (const pair of mappingPairs) {
    if (!pair.oldId || !pair.newId) continue;
    
    console.log(`Reassigning mappings for oldId: ${pair.oldId} -> newId: ${pair.newId}`);
    
    // 1. Update course_offering_faculty
    const { error: coError } = await supabase
      .from('course_offering_faculty')
      .update({ faculty_id: pair.newId })
      .eq('faculty_id', pair.oldId);
      
    if (coError) console.error(`Failed to update course_offering_faculty for ${pair.oldId}:`, coError.message);
    
    // 2. Update session_faculty
    const { error: sfError } = await supabase
      .from('session_faculty')
      .update({ faculty_id: pair.newId })
      .eq('faculty_id', pair.oldId);
      
    if (sfError) console.error(`Failed to update session_faculty for ${pair.oldId}:`, sfError.message);

    // 3. Update exam_entry (entered_by)
    const { error: eeError } = await supabase
      .from('exam_entry')
      .update({ entered_by: pair.newId })
      .eq('entered_by', pair.oldId);
      
    if (eeError) console.error(`Failed to update exam_entry for ${pair.oldId}:`, eeError.message);

    // 4. Update user_login (faculty_id)
    const { error: ulError } = await supabase
      .from('user_login')
      .update({ faculty_id: pair.newId })
      .eq('faculty_id', pair.oldId);
      
    if (ulError) console.error(`Failed to update user_login for ${pair.oldId}:`, ulError.message);
    
    // 5. Delete the old @rvce.edu.in record
    console.log(`Deleting old faculty record: ${pair.oldId}`);
    const { error: dError } = await supabase
      .from('faculty')
      .delete()
      .eq('id', pair.oldId);
      
    if (dError) console.error(`Failed to delete faculty ${pair.oldId}:`, dError.message);
  }
}

reassignMappings().then(() => console.log('--- Done ---'));
