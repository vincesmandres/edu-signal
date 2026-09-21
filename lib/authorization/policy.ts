export function teacherOwnsClassroom(teacherId: string, classroomTeacherId: string) {
  return Boolean(teacherId) && teacherId === classroomTeacherId;
}

export function activeEnrollment(status: string | null | undefined) {
  return status === "active";
}

export function studentOwnsEvidence(studentId: string, evidenceStudentId: string, enrollmentStatus: string | null | undefined) {
  return Boolean(studentId) && studentId === evidenceStudentId && activeEnrollment(enrollmentStatus);
}

export function rubricMatchesClassroom(rubricClassroomId: string, evidenceClassroomId: string, teacherOwnsRubric: boolean) {
  return teacherOwnsRubric && rubricClassroomId === evidenceClassroomId;
}
