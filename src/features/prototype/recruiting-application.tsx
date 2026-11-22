import type { Application } from "./model";
import { RecruiterProfile } from "./recruiter-profile";

export function RecruitingApplication({ application }: { application: Application }) {
  return <RecruiterProfile application={application} />;
}
