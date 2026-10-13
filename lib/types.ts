export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  color: string;
  is_admin: boolean;
};

export type Member = Pick<Profile, "id" | "display_name" | "avatar_url" | "color">;

export type Room = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string | null;
  created_at: string;
};

export type RoomEvent = {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_by: string | null;
  final_start: string | null;
  final_end: string | null;
  created_at: string;
};

export type AvailabilityStatus = "yes" | "maybe";

export type AvailabilityRow = {
  user_id: string;
  day: string;
  status: AvailabilityStatus;
};

export type Message = {
  id: number;
  room_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
};
