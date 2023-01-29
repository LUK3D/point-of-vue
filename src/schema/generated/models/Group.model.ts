import { IsInt, IsDefined, IsOptional, IsString, IsDate } from 'class-validator'
import { Creator, TagsOnGroup } from './'

export class Group {
  @IsDefined()
  @IsInt()
  id!: number

  @IsDefined()
  creators!: Creator[]

  @IsOptional()
  tags?: TagsOnGroup

  @IsDefined()
  @IsString()
  title!: string

  @IsDefined()
  @IsDate()
  createdAt!: Date

  @IsDefined()
  @IsDate()
  updatedAt!: Date

  @IsOptional()
  @IsInt()
  tagsOnGroupGroupId?: number
}
