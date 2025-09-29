/**
 * DCI Hall of Fame Staff Database
 * This file contains the legendary staff members available for hire in marching.art
 * Data sourced from DCI Hall of Fame inductees organized by caption
 */

const dciHallOfFameStaff = [
  // General Effect 1 Staff
  {
    name: "George Zingali",
    caption: "GE1",
    yearInducted: 1994,
    biography: "Legendary designer known for innovative visual concepts and groundbreaking drill design. His work with Blue Devils and other corps revolutionized modern drum corps visual design.",
    achievements: ["Multiple DCI Championships", "Visual Design Pioneer", "Mentor to Modern Designers"],
    specialties: ["Visual Innovation", "Drill Design", "Show Concepts"]
  },
  {
    name: "Frank Arsenault",
    caption: "GE1", 
    yearInducted: 2001,
    biography: "Innovative designer and instructor whose creative vision helped shape the modern drum corps activity. Known for his artistic approach to field design.",
    achievements: ["Championship Designer", "Visual Arts Innovation", "Artistic Excellence"],
    specialties: ["Creative Design", "Artistic Vision", "Show Development"]
  },
  {
    name: "Ralph Hardimon",
    caption: "GE1",
    yearInducted: 2003,
    biography: "Master percussion designer and educator who elevated the artistry of drum corps percussion sections to new heights.",
    achievements: ["Percussion Innovation", "Educational Excellence", "Multiple Championships"],
    specialties: ["Percussion Design", "Musical Excellence", "Educational Leadership"]
  },

  // General Effect 2 Staff  
  {
    name: "Michael Cesario",
    caption: "GE2",
    yearInducted: 2008,
    biography: "Visionary director and designer who brought theatrical elements and emotional depth to drum corps performance.",
    achievements: ["Championship Director", "Theatrical Innovation", "Emotional Storytelling"],
    specialties: ["Show Direction", "Theatrical Elements", "Performance Art"]
  },
  {
    name: "Scott Chandler",
    caption: "GE2", 
    yearInducted: 2010,
    biography: "Master of musical and visual integration, known for creating cohesive show concepts that tell compelling stories.",
    achievements: ["Integrated Design", "Championship Success", "Artistic Leadership"],
    specialties: ["Show Integration", "Concept Development", "Artistic Direction"]
  },

  // Visual Proficiency Staff
  {
    name: "John Bilby",
    caption: "Visual Proficiency",
    yearInducted: 1985,
    biography: "Pioneer of modern drill design techniques and precision marching fundamentals that became industry standards.",
    achievements: ["Drill Design Pioneer", "Technical Innovation", "Educational Leadership"],
    specialties: ["Drill Technique", "Precision Marching", "Visual Standards"]
  },
  {
    name: "Jeff Fiedler", 
    caption: "Visual Proficiency",
    yearInducted: 2012,
    biography: "Technical master who refined modern marching techniques and visual execution standards.",
    achievements: ["Technical Excellence", "Instruction Innovation", "Performance Standards"],
    specialties: ["Marching Technique", "Visual Execution", "Technical Training"]
  },

  // Visual Analysis Staff
  {
    name: "Wayne Downey",
    caption: "Visual Analysis",
    yearInducted: 1989,
    biography: "Legendary judge and educator who helped develop modern visual analysis criteria and judging standards.",
    achievements: ["Judging Excellence", "Educational Impact", "Standards Development"],
    specialties: ["Visual Analysis", "Judging Criteria", "Performance Evaluation"]
  },
  {
    name: "Thom Hannum",
    caption: "Visual Analysis",
    yearInducted: 2006,
    biography: "Master educator and analyst known for developing comprehensive visual training programs and analysis methods.",
    achievements: ["Educational Innovation", "Analysis Excellence", "Training Development"],
    specialties: ["Visual Training", "Performance Analysis", "Educational Systems"]
  },

  // Color Guard Staff
  {
    name: "George Oliviero",
    caption: "Color Guard",
    yearInducted: 1995,
    biography: "Revolutionary color guard designer who elevated guard performance to an art form and established modern standards.",
    achievements: ["Color Guard Innovation", "Artistic Excellence", "Performance Standards"],
    specialties: ["Guard Design", "Equipment Work", "Artistic Expression"]
  },
  {
    name: "Shirley Dorritie",
    caption: "Color Guard", 
    yearInducted: 1999,
    biography: "Pioneering female instructor who broke barriers and created innovative color guard programs.",
    achievements: ["Barrier Breaking", "Innovation Leadership", "Guard Excellence"],
    specialties: ["Guard Innovation", "Leadership Development", "Artistic Vision"]
  },
  {
    name: "Michael Shapiro",
    caption: "Color Guard",
    yearInducted: 2015,
    biography: "Modern color guard innovator known for integrating advanced choreography and contemporary artistic elements.",
    achievements: ["Contemporary Innovation", "Choreographic Excellence", "Artistic Integration"],
    specialties: ["Modern Choreography", "Artistic Integration", "Performance Art"]
  },

  // Brass Staff
  {
    name: "Jim Ott",
    caption: "Brass",
    yearInducted: 1988,
    biography: "Master brass instructor whose teaching methods and musical arrangements set the standard for brass excellence.",
    achievements: ["Brass Excellence", "Teaching Innovation", "Musical Leadership"],
    specialties: ["Brass Technique", "Musical Arrangement", "Sound Development"]
  },
  {
    name: "Jerry Seawright",
    caption: "Brass", 
    yearInducted: 1990,
    biography: "Legendary brass caption head known for developing powerful, precise brass sections with exceptional musical quality.",
    achievements: ["Sound Innovation", "Section Development", "Musical Excellence"],
    specialties: ["Brass Instruction", "Sound Design", "Musical Precision"]
  },
  {
    name: "Gail Royer",
    caption: "Brass",
    yearInducted: 2000,
    biography: "Innovative brass educator who revolutionized warm-up techniques and brass pedagogy in drum corps.",
    achievements: ["Educational Innovation", "Technique Development", "Pedagogical Excellence"],
    specialties: ["Brass Pedagogy", "Warm-up Systems", "Technical Development"]
  },

  // Music Analysis Staff
  {
    name: "Don Angelica",
    caption: "Music Analysis",
    yearInducted: 1992,
    biography: "Master judge and educator who helped establish modern music analysis standards and judging criteria.",
    achievements: ["Judging Excellence", "Standards Development", "Educational Impact"],
    specialties: ["Music Analysis", "Judging Standards", "Educational Leadership"]
  },
  {
    name: "Tom Keck",
    caption: "Music Analysis", 
    yearInducted: 2004,
    biography: "Renowned music educator and analyst known for developing comprehensive musical training programs.",
    achievements: ["Musical Education", "Analysis Innovation", "Training Excellence"],
    specialties: ["Musical Training", "Analysis Methods", "Educational Systems"]
  },

  // Percussion Staff
  {
    name: "Fred Sanford",
    caption: "Percussion",
    yearInducted: 1986,
    biography: "Pioneer of modern drumline techniques and percussion arrangements that influenced generations of performers.",
    achievements: ["Percussion Innovation", "Technical Development", "Educational Leadership"],
    specialties: ["Drumline Technique", "Percussion Arrangements", "Technical Training"]
  },
  {
    name: "Thom Hannum",
    caption: "Percussion",
    yearInducted: 2006,
    biography: "Master percussion educator and designer known for innovative percussion programs and educational methods.",
    achievements: ["Educational Excellence", "Program Innovation", "Technical Mastery"],
    specialties: ["Percussion Education", "Program Development", "Technical Excellence"]
  },
  {
    name: "Paul Rennick",
    caption: "Percussion",
    yearInducted: 2016,
    biography: "Modern percussion master who has redefined contemporary drumline performance and competitive standards.",
    achievements: ["Modern Innovation", "Competitive Excellence", "Technical Advancement"],
    specialties: ["Modern Percussion", "Competitive Performance", "Technical Innovation"]
  },
  {
    name: "Colin McNutt",
    caption: "Percussion",
    yearInducted: 2020,
    biography: "Contemporary percussion designer known for pushing the boundaries of percussion performance and musicality.",
    achievements: ["Contemporary Innovation", "Musical Excellence", "Performance Art"],
    specialties: ["Contemporary Design", "Musical Innovation", "Performance Excellence"]
  }
];

module.exports = { dciHallOfFameStaff };