const supabase = require('../config/supabase');

async function cleanupDuplicates() {
  console.log('--- Cleaning Up Duplicate Faculty Records ---');
  
  // These are the IDs we found that have @rvce.edu.in emails but also have @rvu.edu.in counterparts
  const duplicateIds = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  
  for (const id of duplicateIds) {
    console.log(`Checking mappings for faculty ID: ${id}`);
    
    // Check if this faculty is mapped to any course offerings
    const { data: mappings, error: mError } = await supabase
      .from('course_offering_faculty')
      .select('id')
      .eq('faculty_id', id);
      
    if (mError) {
      console.error(`Error checking mappings for ${id}:`, mError);
      continue;
    }
    
    if (mappings && mappings.length > 0) {
      console.log(`Faculty ${id} has ${mappings.length} mappings. Keeping record.`);
    } else {
      console.log(`Faculty ${id} has NO mappings. Deleting duplicate record.`);
      const { error: dError } = await supabase
        .from('faculty')
        .delete()
        .eq('id', id);
        
      if (dError) {
        console.error(`Failed to delete faculty ${id}:`, dError.message);
      }
    }
  }
}

cleanupDuplicates().then(() => console.log('--- Done ---'));
